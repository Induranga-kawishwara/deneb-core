const fs = require('node:fs');
const path = require('node:path');

const rootDir = path.resolve(__dirname, '..');
const errors = [];

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(rootDir, relativePath), 'utf8'));
}

function expectEqual(label, actual, expected) {
  if (actual !== expected) {
    errors.push(`${label}: expected ${JSON.stringify(expected)}, received ${JSON.stringify(actual)}`);
  }
}

const rootPackage = readJson('package.json');
const rootLock = readJson('package-lock.json');
const cliPackage = readJson('cli/deneb-cli/package.json');
const cliLock = readJson('cli/deneb-cli/package-lock.json');
const corePackage = readJson('packages/deneb-core/package.json');
const uiPackage = readJson('packages/deneb-ui/package.json');
const createPackage = readJson('packages/create-template/package.json');
const sourceTemplate = readJson('templates/nextjs/package.json');
const sourceTemplateLock = readJson('templates/nextjs/package-lock.json');
const bundledTemplate = readJson('packages/create-template/template/package.json');

const releasePackages = [
  ['cli/deneb-cli', cliPackage, '@deneb-ui/cli'],
  ['packages/deneb-core', corePackage, '@deneb-ui/core'],
  ['packages/deneb-ui', uiPackage, '@deneb-ui/ui'],
  ['packages/create-template', createPackage, '@deneb-ui/create-template'],
];

for (const [workspacePath, packageJson, expectedName] of releasePackages) {
  expectEqual(`${workspacePath} name`, packageJson.name, expectedName);
  expectEqual(`${workspacePath} version`, packageJson.version, rootPackage.version);
  expectEqual(`${workspacePath} lock name`, rootLock.packages?.[workspacePath]?.name, expectedName);
  expectEqual(
    `${workspacePath} lock version`,
    rootLock.packages?.[workspacePath]?.version,
    rootPackage.version,
  );
}

expectEqual('root lock name', rootLock.name, rootPackage.name);
expectEqual('root lock version', rootLock.version, rootPackage.version);
expectEqual('root lock package version', rootLock.packages?.['']?.version, rootPackage.version);
expectEqual('CLI standalone lock name', cliLock.name, cliPackage.name);
expectEqual('CLI standalone lock version', cliLock.version, cliPackage.version);
expectEqual('CLI standalone root name', cliLock.packages?.['']?.name, cliPackage.name);
expectEqual('CLI standalone root version', cliLock.packages?.['']?.version, cliPackage.version);

for (const [label, templatePackage] of [
  ['source template', sourceTemplate],
  ['bundled template', bundledTemplate],
]) {
  expectEqual(`${label} name`, templatePackage.name, 'deneb-template-starter');
  expectEqual(`${label} UI dependency`, templatePackage.dependencies?.['@deneb-ui/ui'], `^${rootPackage.version}`);
  expectEqual(`${label} CLI dependency`, templatePackage.devDependencies?.['@deneb-ui/cli'], `^${rootPackage.version}`);
}

expectEqual('template lock name', sourceTemplateLock.name, sourceTemplate.name);
expectEqual('template lock root name', sourceTemplateLock.packages?.['']?.name, sourceTemplate.name);
expectEqual('root template workspace name', rootLock.packages?.['templates/nextjs']?.name, sourceTemplate.name);

// Dynamic Validation: Ensure every workspace in package-lock.json actually exists on disk
for (const packageKey of Object.keys(rootLock.packages || {})) {
  const isWorkspaceEntry =
    !packageKey.includes('/node_modules/') &&
    (packageKey.startsWith('packages/') ||
      packageKey.startsWith('cli/') ||
      packageKey.startsWith('templates/'));
  if (isWorkspaceEntry) {
    const fullPath = path.join(rootDir, packageKey);
    if (!fs.existsSync(fullPath) || !fs.existsSync(path.join(fullPath, 'package.json'))) {
      errors.push(`root lock still contains orphaned workspace ${JSON.stringify(packageKey)} that does not exist on disk`);
    }
  }
}

if (errors.length > 0) {
  console.error(`Package consistency check failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}

console.log(`Package names and versions are consistent at v${rootPackage.version}.`);
