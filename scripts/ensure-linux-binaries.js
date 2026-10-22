const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const rootDir = path.resolve(__dirname, '..');
const nodeModulesDir = path.join(rootDir, 'node_modules');

function downloadAndExtract(pkgName, version, onExtract) {
  const tempDir = path.join(rootDir, `.temp-${pkgName.replace(/[@/]/g, '-')}-${version}`);
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir, { recursive: true });

  try {
    const tarball = execSync(`npm pack ${pkgName}@${version}`, {
      cwd: tempDir,
      encoding: 'utf-8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim().split('\n').pop().trim();

    const tarballPath = path.join(tempDir, tarball);
    execSync(`tar -xzf "${tarballPath}" -C "${tempDir}"`, { stdio: 'ignore' });

    const extractedPkg = path.join(tempDir, 'package');
    onExtract(extractedPkg);
  } catch (err) {
    console.error(`[setup] Error extracting ${pkgName}@${version}:`, err.message);
  } finally {
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (_) {}
  }
}

// 1. lightningcss
function ensureLightningcss(targetDir, version) {
  if (!fs.existsSync(targetDir)) return;
  const nodeFile = path.join(targetDir, 'lightningcss.linux-x64-gnu.node');
  const pkgDir = path.join(path.dirname(targetDir), 'lightningcss-linux-x64-gnu');

  if (fs.existsSync(nodeFile) && fs.existsSync(pkgDir)) return;

  console.log(`[setup] Ensuring lightningcss-linux-x64-gnu@${version}...`);
  downloadAndExtract('lightningcss-linux-x64-gnu', version, (extractedPkg) => {
    const extractedNode = path.join(extractedPkg, 'lightningcss.linux-x64-gnu.node');
    if (fs.existsSync(extractedNode)) {
      fs.copyFileSync(extractedNode, nodeFile);
      if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true });
      for (const file of fs.readdirSync(extractedPkg)) {
        fs.copyFileSync(path.join(extractedPkg, file), path.join(pkgDir, file));
      }
    }
  });
}

const rootLightningcss = path.join(nodeModulesDir, 'lightningcss');
if (fs.existsSync(rootLightningcss)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(rootLightningcss, 'package.json'), 'utf-8'));
    ensureLightningcss(rootLightningcss, pkg.version || '1.32.0');
  } catch (_) {
    ensureLightningcss(rootLightningcss, '1.32.0');
  }
}

const viteLightningcss = path.join(nodeModulesDir, 'vite', 'node_modules', 'lightningcss');
if (fs.existsSync(viteLightningcss)) {
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(viteLightningcss, 'package.json'), 'utf-8'));
    ensureLightningcss(viteLightningcss, pkg.version || '1.33.0');
  } catch (_) {
    ensureLightningcss(viteLightningcss, '1.33.0');
  }
}

// 2. @tailwindcss/oxide
const oxideDir = path.join(nodeModulesDir, '@tailwindcss', 'oxide');
if (fs.existsSync(oxideDir)) {
  const nodeFile = path.join(oxideDir, 'tailwindcss-oxide.linux-x64-gnu.node');
  const pkgDir = path.join(nodeModulesDir, '@tailwindcss', 'oxide-linux-x64-gnu');

  if (!fs.existsSync(nodeFile) || !fs.existsSync(pkgDir)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(oxideDir, 'package.json'), 'utf-8'));
      const version = pkg.version || '4.3.3';
      console.log(`[setup] Ensuring @tailwindcss/oxide-linux-x64-gnu@${version}...`);
      downloadAndExtract('@tailwindcss/oxide-linux-x64-gnu', version, (extractedPkg) => {
        const extractedNode = path.join(extractedPkg, 'tailwindcss-oxide.linux-x64-gnu.node');
        if (fs.existsSync(extractedNode)) {
          fs.copyFileSync(extractedNode, nodeFile);
          if (!fs.existsSync(pkgDir)) fs.mkdirSync(pkgDir, { recursive: true });
          for (const file of fs.readdirSync(extractedPkg)) {
            fs.copyFileSync(path.join(extractedPkg, file), path.join(pkgDir, file));
          }
        }
      });
    } catch (err) {
      console.error('[setup] Error setting up oxide:', err.message);
    }
  }
}

// 3. @next/swc
const nextDir = path.join(nodeModulesDir, 'next');
if (fs.existsSync(nextDir)) {
  const swcPkgDir = path.join(nodeModulesDir, '@next', 'swc-linux-x64-gnu');
  const swcNode = path.join(swcPkgDir, 'next-swc.linux-x64-gnu.node');

  if (!fs.existsSync(swcNode)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(nextDir, 'package.json'), 'utf-8'));
      const version = pkg.version || '15.5.28';
      console.log(`[setup] Ensuring @next/swc-linux-x64-gnu@${version}...`);
      downloadAndExtract('@next/swc-linux-x64-gnu', version, (extractedPkg) => {
        if (!fs.existsSync(swcPkgDir)) fs.mkdirSync(swcPkgDir, { recursive: true });
        for (const file of fs.readdirSync(extractedPkg)) {
          fs.copyFileSync(path.join(extractedPkg, file), path.join(swcPkgDir, file));
        }
      });
    } catch (err) {
      console.error('[setup] Error setting up next/swc:', err.message);
    }
  }
}
