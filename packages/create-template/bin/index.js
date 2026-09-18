#!/usr/bin/env node

const path = require('node:path');
const fs = require('node:fs');
const readline = require('node:readline');

const args = process.argv.slice(2);
let targetDirInput = args[0];

function stripAnsi(str) {
  return str.replace(/\x1b\[[0-9;]*m/g, '');
}

function createBox(lines, width = 58) {
  const cyan = '\x1b[36m';
  const reset = '\x1b[0m';
  const top = `  ${cyan}╔${'═'.repeat(width)}╗${reset}`;
  const bottom = `  ${cyan}╚${'═'.repeat(width)}╝${reset}`;

  const rows = lines.map((line) => {
    const rawLen = stripAnsi(line).length;
    const padTotal = Math.max(0, width - rawLen);
    const padLeft = Math.floor(padTotal / 2);
    const padRight = padTotal - padLeft;
    return `  ${cyan}║${reset}${' '.repeat(padLeft)}${line}${' '.repeat(padRight)}${cyan}║${reset}`;
  });

  return [top, ...rows, bottom].join('\n');
}

function printBanner() {
  console.log('\n' + createBox([
    '\x1b[1m\x1b[37mDENEB TEMPLATE CREATOR\x1b[0m',
    '\x1b[90mScaffold a fast, compliant commerce template\x1b[0m',
    '\x1b[90mPowered by DENEB-UI Collaborate with FIVORA\x1b[0m'
  ], 58) + '\n');
}

function copyFolderSync(src, dest) {
  if (!fs.existsSync(dest)) {
    fs.mkdirSync(dest, { recursive: true });
  }

  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyFolderSync(srcPath, destPath);
    } else if (entry.isFile()) {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const THEME_PRESETS = {
  dual: {
    key: 'dual',
    name: 'Dual-Mode (Light + Dark Switcher) [Recommended]',
    theme: {
      primaryColor: '#016a7e',
      secondaryColor: '#0a1931',
      accentColor: '#00adb5',
      backgroundColor: '#ffffff',
      textColor: '#0f172a',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseSize: '16px',
      heroMinHeight: '72vh',
      sectionPadding: '5rem',
      dark: {
        backgroundColor: '#090d16',
        cardBackgroundColor: '#131b2e',
        textColor: '#f8fafc',
        borderColor: 'rgba(255, 255, 255, 0.12)',
        primaryColor: '#00adb5',
      },
    },
  },
  light: {
    key: 'light',
    name: 'Modern Clean (Pure Light Commerce)',
    theme: {
      primaryColor: '#2563eb',
      secondaryColor: '#1e293b',
      accentColor: '#3b82f6',
      backgroundColor: '#ffffff',
      cardBackgroundColor: '#ffffff',
      textColor: '#0f172a',
      borderColor: '#e2e8f0',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseSize: '16px',
      heroMinHeight: '72vh',
      sectionPadding: '5rem',
    },
  },
  dark: {
    key: 'dark',
    name: 'Luxury Obsidian (Pure Dark Theme)',
    theme: {
      primaryColor: '#6366f1',
      secondaryColor: '#0f172a',
      accentColor: '#818cf8',
      backgroundColor: '#090d16',
      cardBackgroundColor: '#131b2e',
      textColor: '#f8fafc',
      borderColor: 'rgba(255, 255, 255, 0.12)',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseSize: '16px',
      heroMinHeight: '72vh',
      sectionPadding: '5rem',
    },
  },
  emerald: {
    key: 'emerald',
    name: 'Emerald Luxury (Deep Green & Gold)',
    theme: {
      primaryColor: '#10b981',
      secondaryColor: '#064e3b',
      accentColor: '#d97706',
      backgroundColor: '#061a14',
      cardBackgroundColor: '#0c2e24',
      textColor: '#f0fdf4',
      borderColor: 'rgba(16, 185, 129, 0.2)',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseSize: '16px',
      heroMinHeight: '72vh',
      sectionPadding: '5rem',
    },
  },
  cyberpunk: {
    key: 'cyberpunk',
    name: 'Cyberpunk Neon (Futuristic Dark)',
    theme: {
      primaryColor: '#ec4899',
      secondaryColor: '#18181b',
      accentColor: '#06b6d4',
      backgroundColor: '#09090b',
      cardBackgroundColor: '#18181b',
      textColor: '#fafafa',
      borderColor: 'rgba(236, 72, 153, 0.3)',
      headingFont: 'Inter',
      bodyFont: 'Inter',
      baseSize: '16px',
      heroMinHeight: '72vh',
      sectionPadding: '5rem',
    },
  },
};

function resolveThemePreset(input) {
  if (!input) return THEME_PRESETS.dual;
  const clean = input.trim().toLowerCase();
  if (clean === '1' || clean === 'dual') return THEME_PRESETS.dual;
  if (clean === '2' || clean === 'light') return THEME_PRESETS.light;
  if (clean === '3' || clean === 'dark') return THEME_PRESETS.dark;
  if (clean === '4' || clean === 'emerald') return THEME_PRESETS.emerald;
  if (clean === '5' || clean === 'cyberpunk') return THEME_PRESETS.cyberpunk;
  return THEME_PRESETS[clean] || THEME_PRESETS.dual;
}

function runScaffolding(targetInput, chosenThemeKey = 'dual') {
  const targetPath = path.resolve(process.cwd(), targetInput.trim());
  const folderName = path.basename(targetPath);
  const sanitizedPkgName = folderName.toLowerCase().replace(/[^a-z0-9_-]/g, '-');
  const templateDir = path.resolve(__dirname, '..', 'template');
  const selectedPreset = resolveThemePreset(chosenThemeKey);

  if (!fs.existsSync(templateDir)) {
    console.error(`\n\x1b[31mError:\x1b[0m Template directory not found at ${templateDir}`);
    process.exit(1);
  }

  if (fs.existsSync(targetPath) && fs.readdirSync(targetPath).length > 0) {
    console.error(`\n\x1b[31mError:\x1b[0m Target folder "${folderName}" already exists and is not empty.\n`);
    process.exit(1);
  }

  console.log(`\n\x1b[32mCreating DENEB template in:\x1b[0m ${targetPath}...\n`);
  console.log(`  \x1b[36m🎨 Starter Theme Style:\x1b[0m ${selectedPreset.name}`);
  copyFolderSync(templateDir, targetPath);

  // Restore .gitignore if preserved as _gitignore
  const gitignorePath = path.join(targetPath, '_gitignore');
  if (fs.existsSync(gitignorePath)) {
    fs.renameSync(gitignorePath, path.join(targetPath, '.gitignore'));
  }

  // Update package.json name
  const pkgPath = path.join(targetPath, 'package.json');
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
      pkg.name = sanitizedPkgName;
      fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2));
    } catch {
      // ignore
    }
  }

  // Inject selected theme into site-data.json
  const siteDataPath = path.join(targetPath, 'src', 'data', 'site-data.json');
  if (fs.existsSync(siteDataPath)) {
    try {
      const siteData = JSON.parse(fs.readFileSync(siteDataPath, 'utf8'));
      if (siteData.template && siteData.template.structure) {
        siteData.template.structure.theme = {
          ...(siteData.template.structure.theme || {}),
          ...selectedPreset.theme,
        };
      }
      siteData.theme = {
        ...(siteData.theme || {}),
        ...selectedPreset.theme,
      };
      fs.writeFileSync(siteDataPath, JSON.stringify(siteData, null, 2) + '\n');
    } catch {
      // ignore
    }
  }

  console.log(`\x1b[32m✔ Template structure created!\x1b[0m`);
  console.log(`  \x1b[90m- Pre-configured @deneb-ui/ui (ThemeStyles, ThemeToggle & 28+ Editable Components)\x1b[0m`);
  console.log(`  \x1b[90m- Pre-configured @deneb-ui/cli (lab, validate, zip tools)\x1b[0m\n`);

  const skipInstall = process.argv.includes('--skip-install');

  if (!skipInstall) {
    console.log(`\n\x1b[36m📦 Installing dependencies with npm...\x1b[0m \x1b[90m(Next.js 15, Tailwind CSS, @deneb-ui/ui)\x1b[0m\n`);
    try {
      const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      const installRes = require('node:child_process').spawnSync(npmCmd, ['install'], {
        cwd: targetPath,
        stdio: 'inherit',
        shell: process.platform === 'win32',
      });

      if (installRes.status === 0) {
        console.log(`\n\x1b[32m✔ All dependencies and DENEB UI components installed successfully!\x1b[0m\n`);
        try {
          const denebBin = path.join(targetPath, 'node_modules', '@deneb-ui', 'cli', 'bin', 'index.js');
          if (fs.existsSync(denebBin)) {
            console.log(`\x1b[36mAa Downloading and configuring DENEB Google Fonts...\x1b[0m\n`);
            require('node:child_process').spawnSync(process.execPath, [denebBin, 'fonts', 'install', '.'], {
              cwd: targetPath,
              stdio: 'inherit',
              shell: false,
            });
          }
        } catch (err) {
          console.log(`\x1b[33m! Fonts: run "npx deneb fonts install ." inside ${folderName} (${err.message})\x1b[0m\n`);
        }
      } else {
        console.log(`\n\x1b[33m! Note: npm install exited with code ${installRes.status}. Run "npm install" inside ${folderName}.\x1b[0m\n`);
      }
    } catch (err) {
      console.log(`\n\x1b[33m! Note: Could not run npm install automatically: ${err.message}\x1b[0m\n`);
    }
  }

  console.log(`\x1b[32m══════════════════════════════════════════════════════════════════════════════\x1b[0m`);
  console.log(`  \x1b[1m\x1b[32m🎉 Success! Created ${folderName} at ${targetPath}\x1b[0m`);
  console.log(`\x1b[32m══════════════════════════════════════════════════════════════════════════════\x1b[0m\n`);
  console.log(`Your storefront template is pre-configured with:`);
  console.log(`  \x1b[36m⚡ Next.js 15 App Router\x1b[0m (React 19 + Static Export support)`);
  console.log(`  \x1b[36m🎨 Dynamic Theming Engine\x1b[0m (ThemeStyles + ThemeToggle + Zero-FOUC)`);
  console.log(`  \x1b[36m💎 @deneb-ui/ui\x1b[0m (28+ Visual-First Editable Components)`);
  console.log(`  \x1b[36m🛠️ @deneb-ui/cli\x1b[0m (Visual Lab, Preflight Validator & Packager)`);
  console.log(`  \x1b[36m📋 Fivora Manifest\x1b[0m (Version 2 Contract Compliant)\n`);

  console.log(`\x1b[1mNext Steps:\x1b[0m\n`);
  console.log(`  \x1b[36m1. cd ${folderName}\x1b[0m`);
  console.log(`     Navigate into your template directory.\n`);
  if (skipInstall) {
    console.log(`  \x1b[36m2. npm install\x1b[0m`);
    console.log(`     Install dependencies.\n`);
  }
  console.log(`  \x1b[36m${skipInstall ? '3' : '2'}. npm run dev\x1b[0m`);
  console.log(`     Start the local dev server at \x1b[4mhttp://localhost:3000\x1b[0m.`);
  console.log(`     Follow the in-app developer guide right on your homepage!\n`);
  console.log(`  \x1b[36m${skipInstall ? '4' : '3'}. npm run lab\x1b[0m`);
  console.log(`     Launch the interactive Fivora Visual Editing Lab simulation.\n`);
  console.log(`  \x1b[36m${skipInstall ? '5' : '4'}. npm run validate\x1b[0m`);
  console.log(`     Verify preflight compliance to ensure 100% marketplace approval.\n`);
  console.log(`  \x1b[36m${skipInstall ? '6' : '5'}. npm run zip\x1b[0m`);
  console.log(`     Package a clean, upload-ready \x1b[1mfivora-template.zip\x1b[0m.\n`);

  console.log(`\x1b[90mPowered by DENEB-UI Collaborate with FIVORA\x1b[0m`);
  console.log(`\x1b[1m\x1b[36mHappy building with DENEB UI! 🚀\x1b[0m\n`);
}

printBanner();

// Extract CLI flags like --theme=dark or --theme=dual
let cliTheme = null;
const themeArg = args.find((a) => a.startsWith('--theme='));
if (themeArg) {
  cliTheme = themeArg.split('=')[1];
}

const positionalTarget = args.find((a) => !a.startsWith('-'));
const isNonInteractive =
  !process.stdin.isTTY ||
  Boolean(process.env.CI) ||
  args.includes('--yes') ||
  args.includes('-y') ||
  args.includes('--non-interactive') ||
  args.includes('--skip-install');

if (positionalTarget && positionalTarget.trim()) {
  if (cliTheme || isNonInteractive) {
    runScaffolding(positionalTarget, cliTheme || 'dual');
  } else {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    console.log('⚡ Template Theme Selection:\n');
    console.log('  \x1b[36m1)\x1b[0m Dual-Mode \x1b[90m(Light + Dark Switcher pre-installed)\x1b[0m \x1b[32m[Recommended]\x1b[0m');
    console.log('  \x1b[36m2)\x1b[0m Modern Clean \x1b[90m(Pure Light commerce)\x1b[0m');
    console.log('  \x1b[36m3)\x1b[0m Luxury Obsidian \x1b[90m(Pure Dark theme)\x1b[0m');
    console.log('  \x1b[36m4)\x1b[0m Emerald Luxury \x1b[90m(Deep Green & Gold)\x1b[0m');
    console.log('  \x1b[36m5)\x1b[0m Cyberpunk Neon \x1b[90m(Futuristic Dark)\x1b[0m\n');

    rl.question(' \x1b[36m?\x1b[0m \x1b[1mSelect starter theme (1-5, default 1):\x1b[0m ', (themeAns) => {
      rl.close();
      runScaffolding(positionalTarget, themeAns.trim() || 'dual');
    });
  }
} else if (isNonInteractive) {
  runScaffolding('my-deneb-store', cliTheme || 'dual');
} else {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log('⚡ Welcome to DENEB UI Template Creator!\n');
  rl.question(' \x1b[36m?\x1b[0m \x1b[1mWhat is your template name?\x1b[0m \x1b[90m(e.g. my-store)\x1b[0m: ', (answer) => {
    const name = answer.trim() || 'my-deneb-store';
    
    if (cliTheme) {
      rl.close();
      runScaffolding(name, cliTheme);
      return;
    }

    console.log('\n \x1b[36m?\x1b[0m \x1b[1mSelect starter theme style:\x1b[0m');
    console.log('  \x1b[36m1)\x1b[0m Dual-Mode \x1b[90m(Light + Dark Switcher pre-installed)\x1b[0m \x1b[32m[Recommended]\x1b[0m');
    console.log('  \x1b[36m2)\x1b[0m Modern Clean \x1b[90m(Pure Light commerce)\x1b[0m');
    console.log('  \x1b[36m3)\x1b[0m Luxury Obsidian \x1b[90m(Pure Dark theme)\x1b[0m');
    console.log('  \x1b[36m4)\x1b[0m Emerald Luxury \x1b[90m(Deep Green & Gold)\x1b[0m');
    console.log('  \x1b[36m5)\x1b[0m Cyberpunk Neon \x1b[90m(Futuristic Dark)\x1b[0m\n');

    rl.question('  \x1b[1mEnter choice (1-5, default 1):\x1b[0m ', (themeAns) => {
      rl.close();
      runScaffolding(name, themeAns.trim() || 'dual');
    });
  });
}
