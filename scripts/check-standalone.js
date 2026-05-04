const fs = require('fs');
const path = require('path');

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
const serverJs = path.join(standaloneDir, 'server.js');
const staticDir = path.join(__dirname, '..', '.next', 'static');

let hasError = false;

if (!fs.existsSync(standaloneDir)) {
  console.error('❌ .next/standalone directory not found!');
  console.error('   This means next.config.js output:"standalone" is not working.');
  console.error('   Fix: Check next.config.js and re-run "npm run build"');
  hasError = true;
} else {
  console.log('✅ .next/standalone exists');
}

if (!fs.existsSync(serverJs)) {
  console.error('❌ .next/standalone/server.js not found!');
  hasError = true;
} else {
  console.log('✅ server.js exists');
}

if (!fs.existsSync(staticDir)) {
  console.error('❌ .next/static not found!');
  hasError = true;
} else {
  console.log('✅ .next/static exists');
}

if (hasError) {
  console.error('\n💥 Build check failed. Run "npm run build" first.');
  process.exit(1);
} else {
  console.log('\n✅ All checks passed. Proceeding with electron-builder...');
}