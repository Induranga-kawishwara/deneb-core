import { spawn } from 'node:child_process';
import {
  access,
  copyFile,
  lstat,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import {
  basename,
  dirname,
  extname,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

import AdmZip from 'adm-zip';

import { buildTemplateValidationSiteData } from '../src/common/fivora-site-data';
import {
  formatTemplatePackageArchivePolicyError,
  inspectTemplatePackageArchive,
  isForbiddenTemplatePackagePath,
} from '../src/common/template-package-archive';
import {
  normalizeTemplatePackageManifest,
  type TemplatePackageManifest,
} from '../src/common/template-package-manifest';
import {
  addStandardTemplateEditorFields,
  deriveTemplateEditorSchema,
  mergeTemplateEditorSchemas,
  type TemplateEditorSchema,
} from '../src/common/template-editor-schema';
import {
  buildTemplateVisualEditingEmptyContent,
  buildTemplateVisualEditingProbeContent,
  validateTemplateVisualEditingContract,
  validateTemplateVisualEditingEmptyState,
  type TemplateVisualEditingArtifact,
} from '../src/common/template-visual-edit-contract';
import {
  findLinksToUnselectedPages,
  getTemplateValidationSelectedPages,
  normalizeTemplatePageDefinitions,
} from '../src/sites/universal-page-selection';
import { validateTemplateStyleContract } from '../src/common/style-validation';

const CLI_NAME = 'deneb-template-validator';
const CLI_VERSION = '1.0.0';
const MANIFEST_FILE_NAME = 'fivora-template.json';
const MAX_SOURCE_FILES = 2_500;
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const VALIDATION_BASE_PATH = '/template-validation';

const FIVORA_INSTALL_ENV: Record<string, string> = {
  NODE_ENV: 'development',
  NPM_CONFIG_PRODUCTION: 'false',
  npm_config_production: 'false',
  NPM_CONFIG_INCLUDE: 'dev',
  npm_config_include: 'dev',
  NPM_CONFIG_OMIT: '',
  NPM_CONFIG_omit: '',
  NPM_CONFIG_IGNORE_SCRIPTS: 'true',
  npm_config_ignore_scripts: 'true',
  PNPM_CONFIG_IGNORE_SCRIPTS: 'true',
  YARN_IGNORE_SCRIPTS: 'true',
  YARN_PRODUCTION: 'false',
};

type CommandName = 'validate' | 'package';

type CliOptions = {
  command: CommandName;
  inputPath: string;
  outputPath?: string;
  json: boolean;
  force: boolean;
  skipBuild: boolean;
  skipInstall: boolean;
};

type StepResult = {
  name: string;
  status: 'passed' | 'failed' | 'skipped';
  durationMs: number;
  detail?: string;
};

type PreflightReport = {
  validator: typeof CLI_NAME;
  version: typeof CLI_VERSION;
  command: CommandName;
  input: string;
  output?: string;
  status: 'passed' | 'failed';
  startedAt: string;
  durationMs: number;
  steps: StepResult[];
  warnings: string[];
  error?: string;
};

type PackageResult = {
  bytes: number;
  files: number;
  excluded: number;
};

type PreparedWorkspace = {
  sourceDir: string;
  archiveBuffer: Buffer | null;
  packageResult?: PackageResult;
};

class Reporter {
  readonly report: PreflightReport;

  constructor(
    private readonly options: CliOptions,
    startedAt: Date,
  ) {
    this.report = {
      validator: CLI_NAME,
      version: CLI_VERSION,
      command: options.command,
      input: resolve(options.inputPath),
      status: 'passed',
      startedAt: startedAt.toISOString(),
      durationMs: 0,
      steps: [],
      warnings: [],
    };
  }

  async step<T>(name: string, action: () => Promise<T> | T, detail?: string) {
    const started = Date.now();
    if (!this.options.json) process.stdout.write(`→ ${name}\n`);
    try {
      const value = await action();
      this.report.steps.push({
        name,
        status: 'passed',
        durationMs: Date.now() - started,
        ...(detail ? { detail } : {}),
      });
      if (!this.options.json) process.stdout.write(`  ✓ ${name}\n`);
      return value;
    } catch (error) {
      this.report.steps.push({
        name,
        status: 'failed',
        durationMs: Date.now() - started,
        detail: getErrorMessage(error),
      });
      throw error;
    }
  }

  skip(name: string, detail: string) {
    this.report.steps.push({
      name,
      status: 'skipped',
      durationMs: 0,
      detail,
    });
    this.warn(detail);
  }

  warn(message: string) {
    if (!this.report.warnings.includes(message)) {
      this.report.warnings.push(message);
    }
    if (!this.options.json) process.stdout.write(`  ! ${message}\n`);
  }

  finish(startedAt: Date, error?: unknown) {
    this.report.durationMs = Date.now() - startedAt.getTime();
    if (error) {
      this.report.status = 'failed';
      this.report.error = getErrorMessage(error);
    }
  }

  print() {
    if (this.options.json) {
      process.stdout.write(`${JSON.stringify(this.report, null, 2)}\n`);
      return;
    }

    if (this.report.status === 'passed') {
      process.stdout.write(
        `\nTemplate preflight PASSED in ${formatDuration(this.report.durationMs)}.\n`,
      );
      if (this.report.output) {
        process.stdout.write(`Upload-ready ZIP: ${this.report.output}\n`);
      }
      return;
    }

    process.stderr.write(
      `\nTemplate preflight FAILED.\n${this.report.error ?? 'Unknown validation error.'}\n`,
    );
  }
}

export async function runTemplatePreflight(argv = process.argv.slice(2)) {
  let options: CliOptions | null;
  try {
    options = parseArguments(argv);
  } catch (error) {
    const message = getErrorMessage(error);
    if (argv.includes('--json')) {
      process.stdout.write(
        `${JSON.stringify(
          {
            validator: CLI_NAME,
            version: CLI_VERSION,
            status: 'failed',
            error: message,
          },
          null,
          2,
        )}\n`,
      );
    } else {
      process.stderr.write(`${message}\nRun "${CLI_NAME} --help" for usage.\n`);
    }
    return 1;
  }
  if (!options) return 0;

  const startedAt = new Date();
  const reporter = new Reporter(options, startedAt);
  const tempRoot = await mkdtemp(join(tmpdir(), 'fivora-preflight-'));

  try {
    if (options.command === 'package') {
      const outputPath = resolve(
        options.outputPath ??
          join(dirname(resolve(options.inputPath)), 'fivora-template.zip'),
      );
      await ensurePackageDestination(outputPath, options.force);
      const stagedArchivePath = join(tempRoot, 'fivora-template.zip');
      const packageResult = await reporter.step(
        'Create clean source package',
        () =>
          createSourceOnlyArchive(
            resolve(options.inputPath),
            stagedArchivePath,
          ),
      );
      const archiveBuffer = await readFile(stagedArchivePath);
      await reporter.step('Check final ZIP policy', () => {
        assertCleanArchive(archiveBuffer);
      });
      const sourceDir = await extractArchive(
        archiveBuffer,
        join(tempRoot, 'validated-source'),
      );
      await validateWorkspace(sourceDir, options, reporter);
      await publishValidatedArchive(
        stagedArchivePath,
        outputPath,
        options.force,
      );
      reporter.report.output = outputPath;
      reporter.report.steps.push({
        name: 'Publish validated ZIP',
        status: 'passed',
        durationMs: 0,
        detail: `${packageResult.files} files, ${formatBytes(packageResult.bytes)}, ${packageResult.excluded} generated or private entries excluded`,
      });
    } else {
      const prepared = await prepareValidationWorkspace(
        resolve(options.inputPath),
        tempRoot,
        options,
        reporter,
      );
      if (prepared.archiveBuffer) {
        await reporter.step('Check ZIP policy', () => {
          assertCleanArchive(prepared.archiveBuffer!);
        });
      }
      await validateWorkspace(prepared.sourceDir, options, reporter);
    }

    reporter.finish(startedAt);
    reporter.print();
    return 0;
  } catch (error) {
    reporter.finish(startedAt, error);
    reporter.print();
    return 1;
  } finally {
    await rm(tempRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}

async function prepareValidationWorkspace(
  inputPath: string,
  tempRoot: string,
  options: CliOptions,
  reporter: Reporter,
): Promise<PreparedWorkspace> {
  let inputStat: Awaited<ReturnType<typeof stat>>;
  try {
    inputStat = await stat(inputPath);
  } catch {
    throw new Error(`Template path does not exist: ${inputPath}`);
  }

  if (inputStat.isFile()) {
    if (extname(inputPath).toLowerCase() !== '.zip') {
      throw new Error('Template input file must be a .zip archive.');
    }
    if (options.skipBuild || options.skipInstall) {
      throw new Error(
        '--skip-build and --skip-install can only be used with a working source directory, not a ZIP archive.',
      );
    }
    const archiveBuffer = await readFile(inputPath);
    const sourceDir = await extractArchive(
      archiveBuffer,
      join(tempRoot, 'uploaded-source'),
    );
    return { sourceDir, archiveBuffer };
  }

  if (!inputStat.isDirectory()) {
    throw new Error(
      'Template input must be a source directory or .zip archive.',
    );
  }

  if (options.skipBuild || options.skipInstall) {
    reporter.warn(
      'Skip flags validate the working directory in place and are diagnostic only; they do not prove that a clean ZIP is upload-ready.',
    );
    return { sourceDir: inputPath, archiveBuffer: null };
  }

  const stagedArchivePath = join(tempRoot, 'source-snapshot.zip');
  const packageResult = await reporter.step(
    'Prepare isolated source-only snapshot',
    () => createSourceOnlyArchive(inputPath, stagedArchivePath),
  );
  const archiveBuffer = await readFile(stagedArchivePath);
  assertCleanArchive(archiveBuffer);
  const sourceDir = await extractArchive(
    archiveBuffer,
    join(tempRoot, 'source-snapshot'),
  );
  return { sourceDir, archiveBuffer, packageResult };
}


function isNode20Compatible(range: string): boolean {
  if (!range || range === '*' || range === 'latest') return true;
  const parts = range.split('||').map((p) => p.trim());
  return parts.some((part) => {
    const minMatch = part.match(/>=s*(\d+)/);
    if (minMatch) {
      const minMajor = parseInt(minMatch[1], 10);
      return minMajor <= 20;
    }
    const caretMatch = part.match(/\^\s*(\d+)/);
    if (caretMatch) {
      const caretMajor = parseInt(caretMatch[1], 10);
      return caretMajor <= 20;
    }
    const tildeMatch = part.match(/~\s*(\d+)/);
    if (tildeMatch) {
      const tildeMajor = parseInt(tildeMatch[1], 10);
      return tildeMajor <= 20;
    }
    const exactMatch = part.match(/^(\d+)/);
    if (exactMatch) {
      const major = parseInt(exactMatch[1], 10);
      return major === 20;
    }
    return true;
  });
}

async function checkFivoraPlatformEngineCompatibility(
  sourceDir: string,
  reporter: Reporter,
) {
  const localMajor = parseInt(process.versions.node.split('.')[0], 10);
  if (localMajor > 20) {
    reporter.warn(
      `Local Node.js (v${process.versions.node}) is newer than the Fivora platform target runtime (Node 20 LTS). Verifying dependencies for Node 20 compatibility...`,
    );
  }

  const pkgJsonPath = join(sourceDir, 'package.json');
  let pkgJson: any;
  try {
    pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
  } catch {
    return;
  }

  if (pkgJson.engines?.node && !isNode20Compatible(pkgJson.engines.node)) {
    throw new Error(
      `Template package.json specifies engines.node "${pkgJson.engines.node}", which is incompatible with the Fivora platform runtime (Node 20 LTS). Update engines.node to support Node 20 (e.g. ">=20.0.0").`,
    );
  }

  const lockfilePath = join(sourceDir, 'package-lock.json');
  let lockfileRaw = '';
  try {
    lockfileRaw = await readFile(lockfilePath, 'utf8');
  } catch {
    return;
  }

  let lockfile: any;
  try {
    lockfile = JSON.parse(lockfileRaw);
  } catch {
    return;
  }

  const incompatibleDeps: string[] = [];
  const packages = lockfile.packages || {};

  for (const [pkgPath, pkgData] of Object.entries<any>(packages)) {
    if (!pkgPath || pkgPath === '') continue;
    const enginesNode = pkgData?.engines?.node;
    if (enginesNode && typeof enginesNode === 'string') {
      if (!isNode20Compatible(enginesNode)) {
        const pkgName = pkgData.name || pkgPath.replace(/^node_modules\//, '');
        const version = pkgData.version || '';
        incompatibleDeps.push(
          `${pkgName}${version ? `@${version}` : ''} (requires Node "${enginesNode}")`,
        );
      }
    }
  }

  if (incompatibleDeps.length > 0) {
    const formatted = incompatibleDeps.slice(0, 10).map((d) => `  - ${d}`).join('\n');
    const extra = incompatibleDeps.length > 10 ? `\n  - ...and ${incompatibleDeps.length - 10} more` : '';
    throw new Error(
      `Template package includes dependencies that are incompatible with the Fivora platform runtime (Node 20 LTS):\n${formatted}${extra}\n\nPlease downgrade, remove, or replace these dependencies to versions compatible with Node 20.`,
    );
  }
}

async function auditTemplateDependencies(
  sourceDir: string,
  reporter: Reporter,
) {
  const pkgJsonPath = join(sourceDir, 'package.json');
  let pkgJson: any;
  try {
    pkgJson = JSON.parse(await readFile(pkgJsonPath, 'utf8'));
  } catch {
    return;
  }

  const deps = Object.keys(pkgJson.dependencies || {});
  const heavyCheckList = [
    { name: '@react-three/drei', pattern: /@react-three\/drei/ },
    { name: '@react-three/fiber', pattern: /@react-three\/fiber/ },
    { name: 'three', pattern: /(?:from\s+['"]three(?:\/[^'"]*)?['"]|require\(['"]three)/ },
    { name: 'framer-motion', pattern: /framer-motion/ },
    { name: 'pixi.js', pattern: /pixi\.js/ },
    { name: 'babylonjs', pattern: /babylonjs/ },
  ];

  const sourceFiles = await collectFiles(
    sourceDir,
    /\.(tsx?|jsx?|mjs|cjs)$/i,
  );

  const fileContents = await Promise.all(
    sourceFiles.map((file) => readFile(file, 'utf8').catch(() => '')),
  );
  const combinedCode = fileContents.join('\n');

  
  if (combinedCode.includes('next/font/google')) {
    throw new Error(
      'Template package contains "next/font/google" imports (e.g. in layout.tsx). In Fivora preview sandboxes and offline builds, next/font/google causes build failures (ETIMEDOUT) because external Google Fonts cannot be fetched at compile time. Replace next/font/google with DENEB self-hosted fonts by running "deneb fonts install .".',
    );
  }

  for (const item of heavyCheckList) {
    if (deps.includes(item.name) && !item.pattern.test(combinedCode)) {
      reporter.warn(
        `Unused dependency detected: "${item.name}" is declared in package.json dependencies but is never imported in any source file. Removing unused dependencies prevents platform engine conflicts and significantly speeds up live preview warm-up.`,
      );
    }
  }
}

async function simulateInteractivePreviewWarmup(
  sourceDir: string,
  manifest: TemplatePackageManifest,
  originalSiteData: string,
  siteDataPath: string,
  options: CliOptions,
  reporter: Reporter,
) {
  if (options.skipBuild) {
    reporter.skip(
      'Simulate interactive preview warm-up',
      'Skipped by --skip-build.',
    );
    return;
  }

  // 1. Restore the template's bundled demo site-data.json
  await writeFile(siteDataPath, originalSiteData, 'utf8');

  // 2. Clear build artifacts before preview export
  const outputDirectory = manifest.outputDirectory?.trim() || 'out';
  await clearGeneratedBuildArtifacts(sourceDir, outputDirectory);

  // 3. Run production build under simulated platform preview base path
  const simulatedBasePath = '/uploads/generated-sites/template-preview/simulation';
  const previewCommandEnv: Record<string, string> = {
    NODE_ENV: 'production',
    ...(manifest.basePathEnvVar?.trim()
      ? { [manifest.basePathEnvVar.trim()]: simulatedBasePath }
      : { NEXT_PUBLIC_SITE_BASE_PATH: simulatedBasePath }),
    ...(manifest.publicSiteUrlEnvVar?.trim()
      ? { [manifest.publicSiteUrlEnvVar.trim()]: `https://fivora.com${simulatedBasePath}/` }
      : {}),
  };

  const buildCommand = manifest.buildCommand?.trim() || 'npm run build';
  await runCommand(buildCommand, sourceDir, previewCommandEnv, options.json);

  // 4. Verify static export output exists
  const outputPath = resolveWithin(sourceDir, outputDirectory);
  await access(outputPath).catch(() => {
    throw new Error(
      `Interactive preview build did not produce output directory "${outputDirectory}".`,
    );
  });

  // 5. Test generated HTML files
  const htmlFiles = await collectFiles(outputPath, /\.html$/i);
  if (htmlFiles.length === 0) {
    throw new Error(
      `Interactive preview build produced no HTML files in output directory "${outputDirectory}".`,
    );
  }

  for (const htmlPath of htmlFiles.slice(0, 10)) {
    const html = await readFile(htmlPath, 'utf8');
    if (!html.includes('<!DOCTYPE') && !html.includes('<html')) {
      throw new Error(
        `Generated preview HTML "${relative(sourceDir, htmlPath)}" is malformed.`,
      );
    }
  }
}

async function validateWorkspace(
  sourceDir: string,
  options: CliOptions,
  reporter: Reporter,
) {
  const manifest = await reporter.step('Validate manifest', () =>
    readManifest(sourceDir),
  );
  if (manifest.version < 2) {
    throw new Error(
      'New template package uploads require fivora-template.json version 2 with visualEditing.contractVersion 1 and visualEditing.mode "strict".',
    );
  }

  await reporter.step('Check required package files', async () => {
    const pkgPath = join(sourceDir, 'package.json');
    await access(pkgPath).catch(() => {
      throw new Error(
        'Template package must contain package.json at ZIP root.',
      );
    });

    let pkgJson: Record<string, unknown> | null = null;
    try {
      pkgJson = JSON.parse(await readFile(pkgPath, 'utf8')) as Record<string, unknown>;
    } catch {
      // Ignored here
    }

    const deps = {
      ...((pkgJson?.dependencies as Record<string, string>) || {}),
      ...((pkgJson?.devDependencies as Record<string, string>) || {}),
    };
    const isNext = Boolean(deps.next);

    if (isNext) {
      const notFoundCandidates = [
        'src/app/not-found.tsx',
        'src/app/not-found.jsx',
        'src/app/not-found.js',
        'app/not-found.tsx',
        'app/not-found.jsx',
        'app/not-found.js',
        'src/pages/404.tsx',
        'src/pages/404.jsx',
        'src/pages/404.js',
        'pages/404.tsx',
        'pages/404.jsx',
        'pages/404.js',
      ];
      const hasNotFound = await Promise.any(
        notFoundCandidates.map(async (candidate) => {
          await access(join(sourceDir, candidate));
          return true;
        }),
      ).catch(() => false);

      if (!hasNotFound) {
        reporter.warn(
          'Template is missing an explicit 404/not-found page (e.g. "src/app/not-found.tsx"). ' +
            'In Next.js 15 static export, missing not-found.tsx causes Next.js to fall back to legacy "_error.js" and crash with "TypeError: Cannot read properties of null (reading \'useContext\')".',
        );
      }
    }
  });

  const { contentDefaults, originalSiteData, siteDataPath } =
    await reporter.step('Validate site data', () =>
      readTemplateContentDefaults(sourceDir, manifest),
    );
  const editorSchema = finalizeEditorSchema(manifest, contentDefaults);
  const selectedPages = getTemplateValidationSelectedPages(
    manifest.pages ?? [],
  );

  try {
    await reporter.step('Check platform runtime compatibility', async () => {
      await checkFivoraPlatformEngineCompatibility(sourceDir, reporter);
    });

    await reporter.step('Audit package dependencies', async () => {
      await auditTemplateDependencies(sourceDir, reporter);
    });

    if (options.skipInstall) {
      reporter.skip(
        'Install dependencies',
        'Dependency installation was skipped by --skip-install.',
      );
    } else {
      const installCommand = manifest.installCommand?.trim() || 'npm install';
      await reporter.step('Install dependencies', () =>
        runCommand(installCommand, sourceDir, FIVORA_INSTALL_ENV, options.json),
      );
    }

    const probeContent = buildTemplateVisualEditingProbeContent(
      contentDefaults,
      editorSchema,
    );
    await writeFixture(siteDataPath, probeContent, selectedPages);
    await buildOrReuseExport(
      sourceDir,
      manifest,
      options,
      reporter,
      'Build probe-content fixture',
    );
    const probeArtifacts = await readArtifacts(
      sourceDir,
      manifest.outputDirectory?.trim() || 'out',
    );
    await reporter.step('Validate probe-content contract', () => {
      const result = validateTemplateVisualEditingContract({
        manifestVersion: manifest.version,
        visualEditing: manifest.visualEditing,
        pages: manifest.pages,
        contentDefaults: probeContent,
        editorSchema,
        artifacts: probeArtifacts,
      });
      const pageDefinitions = normalizeTemplatePageDefinitions(
        { pages: manifest.pages },
        manifest.pages?.map((page) => page.id) ?? [],
      );
      const selectedPageFiles = new Set(
        result.markers
          .filter(
            (marker) =>
              marker.kind === 'page' &&
              marker.artifactKind === 'html' &&
              selectedPages.includes(marker.value),
          )
          .map((marker) => marker.filePath),
      );
      result.errors.push(
        ...new Set(
          probeArtifacts
            .filter(
              (artifact) =>
                artifact.kind === 'html' &&
                selectedPageFiles.has(artifact.filePath),
            )
            .flatMap((artifact) =>
              findLinksToUnselectedPages({
                html: artifact.content,
                pageDefinitions,
                selectedPages,
                basePath: VALIDATION_BASE_PATH,
              }).map(
                (finding) =>
                  `${artifact.filePath} still renders href="${finding.href}" for unselected page "${finding.pageId}". Filter every header, hero, body, card, and footer link with requirements.requiredPages.`,
              ),
            ),
        ),
      );
      for (const warning of result.warnings) reporter.warn(warning);
      assertContractPassed(
        'Template visual-editing contract validation failed.',
        result.errors,
      );
    });

    await reporter.step('Validate real-time style contract', () => {
      const styleIssues = validateTemplateStyleContract({
        siteData: probeContent,
        artifacts: probeArtifacts,
      });
      assertContractPassed(
        'Template real-time style validation failed.',
        styleIssues.map((issue) => `${issue.path}: ${issue.message}`),
      );
    });

    const emptyContent = buildTemplateVisualEditingEmptyContent(
      contentDefaults,
      editorSchema,
    );
    await writeFixture(siteDataPath, emptyContent);
    await buildOrReuseExport(
      sourceDir,
      manifest,
      options,
      reporter,
      'Build empty-state fixture',
    );
    const emptyArtifacts = await readArtifacts(
      sourceDir,
      manifest.outputDirectory?.trim() || 'out',
    );
    await reporter.step('Validate empty-state contract', () => {
      const result = validateTemplateVisualEditingEmptyState({
        manifestVersion: manifest.version,
        visualEditing: manifest.visualEditing,
        pages: manifest.pages,
        contentDefaults,
        editorSchema,
        artifacts: emptyArtifacts,
      });
      for (const warning of result.warnings) reporter.warn(warning);
      assertContractPassed(
        'Template strict empty-state visual-editing validation failed.',
        result.errors,
      );
    });

    await reporter.step('Simulate interactive preview warm-up', async () => {
      await simulateInteractivePreviewWarmup(
        sourceDir,
        manifest,
        originalSiteData,
        siteDataPath,
        options,
        reporter,
      );
    });
  } finally {
    await writeFile(siteDataPath, originalSiteData, 'utf8').catch(
      () => undefined,
    );
  }
}

async function buildOrReuseExport(
  sourceDir: string,
  manifest: TemplatePackageManifest,
  options: CliOptions,
  reporter: Reporter,
  stepName: string,
) {
  if (options.skipBuild) {
    reporter.skip(stepName, `${stepName} was skipped by --skip-build.`);
    const outputPath = resolveWithin(
      sourceDir,
      manifest.outputDirectory?.trim() || 'out',
    );
    await access(outputPath).catch(() => {
      throw new Error(
        `Cannot use --skip-build because output directory "${manifest.outputDirectory?.trim() || 'out'}" does not exist.`,
      );
    });
    return;
  }

  await reporter.step(stepName, async () => {
    const outputDirectory = manifest.outputDirectory?.trim() || 'out';
    await clearGeneratedBuildArtifacts(sourceDir, outputDirectory);
    const commandEnv = {
      ...(manifest.basePathEnvVar?.trim()
        ? { [manifest.basePathEnvVar.trim()]: VALIDATION_BASE_PATH }
        : {}),
      ...(manifest.publicSiteUrlEnvVar?.trim()
        ? {
            [manifest.publicSiteUrlEnvVar.trim()]:
              'https://template-validation.example.invalid',
          }
        : {}),
      NODE_ENV: 'production',
    };
    await runCommand(
      manifest.buildCommand?.trim() || 'npm run build',
      sourceDir,
      commandEnv,
      options.json,
    );
    await access(resolveWithin(sourceDir, outputDirectory)).catch(() => {
      throw new Error(
        `Template build completed, but output directory "${outputDirectory}" was not created.`,
      );
    });
  });
}

async function readManifest(sourceDir: string) {
  const manifestPath = join(sourceDir, MANIFEST_FILE_NAME);
  let parsed: unknown;
  try {
    parsed = JSON.parse(await readFile(manifestPath, 'utf8')) as unknown;
  } catch (error) {
    throw new Error(
      `${MANIFEST_FILE_NAME} is missing from the package root or is not valid JSON: ${getErrorMessage(error)}`,
    );
  }
  return normalizeTemplatePackageManifest(parsed);
}

async function readTemplateContentDefaults(
  sourceDir: string,
  manifest: TemplatePackageManifest,
) {
  const siteDataPath = resolveWithin(sourceDir, manifest.siteDataFile);
  let originalSiteData: string;
  let parsed: { content?: unknown; shop?: { logoUrl?: unknown } };

  try {
    originalSiteData = await readFile(siteDataPath, 'utf8');
    parsed = JSON.parse(originalSiteData) as typeof parsed;
  } catch (error) {
    throw new Error(
      `Template site data file "${manifest.siteDataFile}" is missing or is not valid JSON: ${getErrorMessage(error)}`,
    );
  }

  if (
    !parsed.content ||
    typeof parsed.content !== 'object' ||
    Array.isArray(parsed.content)
  ) {
    throw new Error(
      `Template site data file "${manifest.siteDataFile}" must contain a JSON object at "content".`,
    );
  }

  const contentDefaults = structuredClone(
    parsed.content as Record<string, unknown>,
  );
  const logoUrl =
    typeof parsed.shop?.logoUrl === 'string' ? parsed.shop.logoUrl.trim() : '';
  if (logoUrl) {
    const common =
      contentDefaults.common &&
      typeof contentDefaults.common === 'object' &&
      !Array.isArray(contentDefaults.common)
        ? (contentDefaults.common as Record<string, unknown>)
        : {};
    contentDefaults.common = {
      ...common,
      logoUrl:
        typeof common.logoUrl === 'string' && common.logoUrl.trim()
          ? common.logoUrl
          : logoUrl,
    };
  }

  return { contentDefaults, originalSiteData, siteDataPath };
}

function finalizeEditorSchema(
  manifest: TemplatePackageManifest,
  contentDefaults: Record<string, unknown>,
): TemplateEditorSchema | null {
  return addStandardTemplateEditorFields(
    mergeTemplateEditorSchemas(
      manifest.editorSchema ?? null,
      deriveTemplateEditorSchema(contentDefaults, manifest.pages ?? []),
    ),
  );
}

async function writeFixture(
  siteDataPath: string,
  content: Record<string, unknown> | null,
  requiredPages: string[] = [],
) {
  await mkdir(dirname(siteDataPath), { recursive: true });
  await writeFile(
    siteDataPath,
    JSON.stringify(
      buildTemplateValidationSiteData(content, requiredPages),
      null,
      2,
    ),
    'utf8',
  );
}

async function createSourceOnlyArchive(
  sourceDir: string,
  destinationPath: string,
): Promise<PackageResult> {
  const sourceInfo = await stat(sourceDir).catch(() => null);
  if (!sourceInfo?.isDirectory()) {
    throw new Error(`Template source directory does not exist: ${sourceDir}`);
  }

  const zip = new AdmZip();
  let files = 0;
  let bytes = 0;
  let excluded = 0;

  const visit = async (currentPath: string) => {
    const entries = await readdir(currentPath, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      const archivePath = relative(sourceDir, entryPath).split(sep).join('/');
      if (isForbiddenTemplatePackagePath(archivePath)) {
        excluded += 1;
        continue;
      }
      const info = await lstat(entryPath);
      if (info.isSymbolicLink()) {
        throw new Error(
          `Template source contains a symbolic link that cannot be packaged safely: ${archivePath}`,
        );
      }
      if (info.isDirectory()) {
        await visit(entryPath);
        continue;
      }
      if (!info.isFile()) continue;

      const content = await readFile(entryPath);
      zip.addFile(archivePath, content);
      files += 1;
      bytes += content.byteLength;
    }
  };

  await visit(sourceDir);
  if (files === 0) throw new Error('Template source directory is empty.');
  await mkdir(dirname(destinationPath), { recursive: true });
  await writeFile(destinationPath, zip.toBuffer());
  return { bytes, files, excluded };
}

async function extractArchive(buffer: Buffer, destinationPath: string) {
  assertCleanArchive(buffer);
  await mkdir(destinationPath, { recursive: true });
  new AdmZip(buffer).extractAllTo(destinationPath, true);
  return destinationPath;
}

function assertCleanArchive(buffer: Buffer) {
  const inspection = inspectTemplatePackageArchive(buffer);
  if (inspection.forbiddenEntries.length > 0) {
    throw new Error(
      formatTemplatePackageArchivePolicyError(inspection.forbiddenEntries),
    );
  }
  if (!inspection.entries.includes(MANIFEST_FILE_NAME)) {
    throw new Error(
      `${MANIFEST_FILE_NAME} must be at the ZIP root. Do not wrap the template in an extra parent directory.`,
    );
  }
}

async function readArtifacts(
  sourceDir: string,
  outputDirectory: string,
): Promise<TemplateVisualEditingArtifact[]> {
  const outputPath = resolveWithin(sourceDir, outputDirectory);
  const [sourceFiles, htmlFiles] = await Promise.all([
    collectFiles(sourceDir, /\.(?:[cm]?[jt]sx?|html?)$/i, outputPath),
    collectFiles(outputPath, /\.html?$/i),
  ]);
  const artifacts: TemplateVisualEditingArtifact[] = [];
  let sourceBytes = 0;

  for (const filePath of sourceFiles.slice(0, MAX_SOURCE_FILES)) {
    const content = await readFile(filePath, 'utf8');
    sourceBytes += Buffer.byteLength(content);
    if (sourceBytes > MAX_SOURCE_BYTES) break;
    artifacts.push({
      filePath: `source/${relative(sourceDir, filePath).split(sep).join('/')}`,
      kind: 'source',
      content,
    });
  }
  for (const filePath of htmlFiles) {
    artifacts.push({
      filePath: relative(outputPath, filePath).split(sep).join('/'),
      kind: 'html',
      content: await readFile(filePath, 'utf8'),
    });
  }
  return artifacts;
}

async function collectFiles(
  rootPath: string,
  pattern: RegExp,
  excludedPath?: string,
) {
  const ignoredDirectories = new Set([
    '.git',
    '.next',
    '.turbo',
    'build',
    'coverage',
    'dist',
    'node_modules',
  ]);
  const files: string[] = [];

  const visit = async (currentPath: string) => {
    if (excludedPath && resolve(currentPath) === resolve(excludedPath)) return;
    const entries = await readdir(currentPath, { withFileTypes: true });
    for (const entry of entries) {
      const entryPath = join(currentPath, entry.name);
      if (entry.isDirectory()) {
        if (!ignoredDirectories.has(entry.name.toLowerCase())) {
          await visit(entryPath);
        }
      } else if (entry.isFile() && pattern.test(entry.name)) {
        files.push(entryPath);
      }
    }
  };

  await visit(rootPath);
  return files.sort();
}

async function clearGeneratedBuildArtifacts(
  sourceDir: string,
  outputDirectory: string,
) {
  const outputPath = resolveWithin(sourceDir, outputDirectory);
  if (outputPath !== resolve(sourceDir)) {
    await rm(outputPath, { recursive: true, force: true });
  }
  for (const relativePath of ['.next', '.turbo']) {
    await rm(resolveWithin(sourceDir, relativePath), {
      recursive: true,
      force: true,
    });
  }
}

async function runCommand(
  command: string,
  cwd: string,
  extraEnv: Record<string, string>,
  quiet: boolean,
) {
  if (!command.trim()) return;
  await new Promise<void>((resolvePromise, reject) => {
    const child = spawn(command, {
      cwd,
      env: { ...process.env, ...extraEnv },
      shell: true,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    const record = (chunk: Buffer, target: NodeJS.WriteStream) => {
      const text = chunk.toString();
      output = `${output}${text}`.slice(-64 * 1024);
      if (!quiet) target.write(chunk);
    };
    child.stdout?.on('data', (chunk: Buffer) => record(chunk, process.stdout));
    child.stderr?.on('data', (chunk: Buffer) => record(chunk, process.stderr));
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) {
        resolvePromise();
        return;
      }
      const excerpt = formatCommandOutput(output);
      reject(
        new Error(
          [
            `Command failed: ${command}`,
            signal
              ? `Process stopped by signal ${signal}.`
              : `Exit code: ${code ?? 'unknown'}.`,
            ...(excerpt ? [excerpt] : []),
          ].join('\n'),
        ),
      );
    });
  });
}

function assertContractPassed(title: string, errors: string[]) {
  if (errors.length === 0) return;
  const examples = errors.slice(0, 36);
  const remaining = errors.length - examples.length;
  throw new Error(
    [
      title,
      ...examples.map((error) => `- ${error}`),
      ...(remaining > 0
        ? [`- ${remaining} additional contract errors were omitted.`]
        : []),
    ].join('\n'),
  );
}

function resolveWithin(baseDir: string, relativePath: string) {
  const resolvedBase = resolve(baseDir);
  const targetPath = resolve(baseDir, relativePath);
  const normalizedBase = `${resolvedBase}${sep}`;
  if (targetPath !== resolvedBase && !targetPath.startsWith(normalizedBase)) {
    throw new Error('Template path resolves outside the workspace.');
  }
  return targetPath;
}

async function ensurePackageDestination(outputPath: string, force: boolean) {
  if (extname(outputPath).toLowerCase() !== '.zip') {
    throw new Error(
      `Package output must use the .zip extension: ${outputPath}`,
    );
  }
  const existing = await stat(outputPath).catch(() => null);
  if (existing && !force) {
    throw new Error(
      `Output already exists: ${outputPath}. Use --force to replace it after validation passes.`,
    );
  }
  if (existing?.isDirectory()) {
    throw new Error(`Output path is a directory: ${outputPath}`);
  }
}

async function publishValidatedArchive(
  stagedArchivePath: string,
  outputPath: string,
  force: boolean,
) {
  const outputDirectory = dirname(outputPath);
  const destinationStage = join(
    outputDirectory,
    `.${basename(outputPath)}.${process.pid}-${Date.now()}.tmp`,
  );
  await mkdir(outputDirectory, { recursive: true });

  try {
    await copyFile(stagedArchivePath, destinationStage);
    await ensurePackageDestination(outputPath, force);
    if (force) await rm(outputPath, { force: true });
    await rename(destinationStage, outputPath);
  } finally {
    await rm(destinationStage, { force: true }).catch(() => undefined);
  }
}

function parseArguments(argv: string[]): CliOptions | null {
  if (argv.includes('--help') || argv.includes('-h')) {
    printHelp();
    return null;
  }
  if (argv.includes('--version') || argv.includes('-v')) {
    process.stdout.write(`${CLI_VERSION}\n`);
    return null;
  }

  const args = [...argv];
  const explicitCommand = args[0] === 'validate' || args[0] === 'package';
  const command = (explicitCommand ? args.shift() : 'validate') as CommandName;
  let inputPath = '';
  let outputPath: string | undefined;
  let json = false;
  let force = false;
  let skipBuild = false;
  let skipInstall = false;

  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === '--json') json = true;
    else if (arg === '--force') force = true;
    else if (arg === '--skip-build') skipBuild = true;
    else if (arg === '--skip-install') skipInstall = true;
    else if (arg === '--output' || arg === '-o') {
      outputPath = args[index + 1];
      index += 1;
      if (!outputPath) throw new Error(`${arg} requires a file path.`);
    } else if (arg.startsWith('--output=')) {
      outputPath = arg.slice('--output='.length);
    } else if (arg.startsWith('-')) {
      throw new Error(`Unknown option: ${arg}`);
    } else if (!inputPath) {
      inputPath = arg;
    } else {
      throw new Error(`Unexpected argument: ${arg}`);
    }
  }

  if (!inputPath) {
    throw new Error(
      `Template path is required. Run "${CLI_NAME} --help" for usage.`,
    );
  }
  if (command === 'package' && (skipBuild || skipInstall)) {
    throw new Error(
      'The package command cannot use --skip-build or --skip-install because the final ZIP must pass full validation.',
    );
  }
  if (command === 'validate' && outputPath) {
    throw new Error('--output is only valid with the package command.');
  }

  return {
    command,
    inputPath,
    outputPath,
    json,
    force,
    skipBuild,
    skipInstall,
  };
}

function printHelp() {
  process.stdout.write(
    `Fivora Template Preflight Validator v${CLI_VERSION}\n\n`,
  );
  process.stdout.write('Usage:\n');
  process.stdout.write(
    `  ${CLI_NAME} validate <template-directory-or-zip> [--json]\n`,
  );
  process.stdout.write(
    `  ${CLI_NAME} package <template-directory> [--output <file.zip>] [--force] [--json]\n\n`,
  );
  process.stdout.write('Commands:\n');
  process.stdout.write(
    '  validate  Validate an isolated source-only snapshot or an existing ZIP.\n',
  );
  process.stdout.write(
    '  package   Create a clean ZIP, validate that exact archive, then publish it.\n\n',
  );
  process.stdout.write('Diagnostic options:\n');
  process.stdout.write(
    '  --skip-install  Reuse dependencies in a working directory (not upload proof).\n',
  );
  process.stdout.write(
    '  --skip-build    Inspect an existing export in place (not upload proof).\n',
  );
}

function formatCommandOutput(output: string) {
  const lines = output
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);
  if (lines.length <= 28) return lines.join('\n');
  return `${lines.slice(0, 8).join('\n')}\n...\n${lines.slice(-20).join('\n')}`;
}

function getErrorMessage(error: unknown) {
  return error instanceof Error
    ? error.message
    : typeof error === 'string'
      ? error
      : 'Unknown validation error.';
}

function formatDuration(durationMs: number) {
  return durationMs < 1_000
    ? `${durationMs}ms`
    : `${(durationMs / 1_000).toFixed(1)}s`;
}

function formatBytes(bytes: number) {
  if (bytes < 1_024) return `${bytes} B`;
  if (bytes < 1_024 * 1_024) return `${(bytes / 1_024).toFixed(1)} KiB`;
  return `${(bytes / (1_024 * 1_024)).toFixed(1)} MiB`;
}

if (require.main === module) {
  void runTemplatePreflight().then((exitCode) => {
    process.exitCode = exitCode;
  });
}
