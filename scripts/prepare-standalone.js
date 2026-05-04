const fs = require('fs');
const path = require('path');

const standaloneDir = path.join(__dirname, '..', '.next', 'standalone');
const standaloneNM = path.join(standaloneDir, 'node_modules');
const projectNM = path.join(__dirname, '..', 'node_modules');

console.log('📦 Merging ALL node_modules into standalone...');

const entries = fs.readdirSync(projectNM);
let copied = 0;

for (const entry of entries) {
  const dest = path.join(standaloneNM, entry);
  if (fs.existsSync(dest)) continue;
  const src = path.join(projectNM, entry);
  try {
    fs.cpSync(src, dest, { recursive: true });
    copied++;
  } catch (e) {
    console.warn(`⚠️  Skipped ${entry}: ${e.message}`);
  }
}

// styled-jsx must also live inside next/node_modules for require-hook to find it
const styledJsxSrc = path.join(projectNM, 'styled-jsx');
const styledJsxDest = path.join(standaloneNM, 'next', 'node_modules', 'styled-jsx');
if (!fs.existsSync(styledJsxDest)) {
  console.log('📦 Copying styled-jsx into next/node_modules...');
  fs.cpSync(styledJsxSrc, styledJsxDest, { recursive: true });
  console.log('✅ styled-jsx nested copy done');
} else {
  console.log('✅ styled-jsx already in next/node_modules');
}

console.log(`✅ Merged ${copied} packages. Standalone ready.`);

// Remove dev-only packages that bloat the installer
console.log('\n🗑️  Removing dev-only packages from standalone...');
const devOnlyPackages = [
  'electron',
  'electron-builder',
  'electron-winstaller',
  'app-builder-bin',
  'builder-util',
  'builder-util-runtime',
  'eslint',
  'eslint-config-next',
  '@eslint',
  'typescript',
  'wait-on',
  '7zip-bin',
  '@electron',
  'dmg-builder',
  'nsis-resources',
];

let removed = 0;
for (const pkg of devOnlyPackages) {
  const pkgPath = path.join(standaloneNM, pkg);
  if (fs.existsSync(pkgPath)) {
    try {
      fs.rmSync(pkgPath, { recursive: true, force: true });
      console.log(`  🗑️  Removed: ${pkg}`);
      removed++;
    } catch (e) {
      console.warn(`  ⚠️  Could not remove ${pkg}: ${e.message}`);
    }
  }
}

console.log(`\n✅ Removed ${removed} dev packages.`);
console.log('✅ Standalone fully prepared and optimized.');