const { app, BrowserWindow, dialog } = require('electron');
const path = require('path');
const { spawn, execSync } = require('child_process');
const fs = require('fs');
const net = require('net');

let mainWindow;
let nextServerProcess;
const PORT = 3019;

// Kill any process already using our port
function killPortProcess(port) {
  try {
    const result = execSync(`netstat -ano | findstr :${port}`, { encoding: 'utf8' });
    const lines = result.trim().split('\n');
    const pids = new Set();
    for (const line of lines) {
      const parts = line.trim().split(/\s+/);
      const pid = parts[parts.length - 1];
      if (pid && pid !== '0') pids.add(pid);
    }
    for (const pid of pids) {
      try {
        execSync(`taskkill /PID ${pid} /F`, { stdio: 'ignore' });
        console.log(`Killed PID ${pid} on port ${port}`);
      } catch {}
    }
  } catch {
    // Port not in use, that's fine
  }
}

function waitForPort(port, host, timeout = 30000) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const tryConnect = () => {
      const socket = new net.Socket();
      socket.setTimeout(500);
      socket
        .once('connect', () => { socket.destroy(); resolve(); })
        .once('error', () => { socket.destroy(); retry(); })
        .once('timeout', () => { socket.destroy(); retry(); })
        .connect(port, host);
    };
    const retry = () => {
      if (Date.now() - start >= timeout) {
        reject(new Error(`Port ${port} did not open within ${timeout}ms`));
      } else {
        setTimeout(tryConnect, 500);
      }
    };
    tryConnect();
  });
}

function killServer() {
  if (nextServerProcess) {
    try {
      // Kill the process tree on Windows
      execSync(`taskkill /PID ${nextServerProcess.pid} /T /F`, { stdio: 'ignore' });
    } catch {}
    nextServerProcess = null;
  }
  // Also free the port just in case
  killPortProcess(PORT);
}

app.whenReady().then(async () => {
  // Clean up any leftover process on startup
  killPortProcess(PORT);

  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    show: false,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      webSecurity: false,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  const isDev = !app.isPackaged;

  if (isDev) {
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
    mainWindow.webContents.openDevTools();
    return;
  }

  const standaloneDir = path.join(process.resourcesPath, 'standalone');
  const serverPath = path.join(standaloneDir, 'server.js');

  if (!fs.existsSync(serverPath)) {
    dialog.showErrorBox('Build Error', `server.js not found at:\n${serverPath}`);
    app.quit();
    return;
  }

  const stderrLines = [];

  nextServerProcess = spawn(process.execPath, [serverPath], {
    cwd: standaloneDir,
    env: {
      ...process.env,
      PORT: String(PORT),
      HOSTNAME: '127.0.0.1',
      ELECTRON_RUN_AS_NODE: '1',
    },
  });

  nextServerProcess.stdout.on('data', (d) => console.log(`[server]: ${d}`));
  nextServerProcess.stderr.on('data', (d) => {
    const line = d.toString();
    console.error(`[server stderr]: ${line}`);
    stderrLines.push(line);
  });

  nextServerProcess.on('exit', (code) => {
    if (code !== 0 && code !== null) {
      const details = stderrLines.slice(-10).join('');
      dialog.showErrorBox('Server Died', `Exit code: ${code}\n\n${details}`);
    }
  });

  try {
    await waitForPort(PORT, '127.0.0.1', 30000);
    mainWindow.loadURL(`http://127.0.0.1:${PORT}`);
  } catch (err) {
    const details = stderrLines.slice(-10).join('');
    dialog.showErrorBox('Server Failed to Start', `${details || err.message}`);
    app.quit();
  }
});

// Handle all possible close events
app.on('before-quit', () => killServer());
app.on('will-quit', () => killServer());
app.on('window-all-closed', () => {
  killServer();
  if (process.platform !== 'darwin') app.quit();
});

process.on('exit', () => killServer());
process.on('SIGINT', () => { killServer(); process.exit(0); });
process.on('SIGTERM', () => { killServer(); process.exit(0); });