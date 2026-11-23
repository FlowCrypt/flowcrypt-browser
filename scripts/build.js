/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
const fs = require('node:fs');
const path = require('path');
const { spawn } = require('child_process');
const { cp, glob } = require('node:fs/promises');

const ROOT_DIR = process.cwd();
const OUTPUT_DIRECTORY = path.resolve(ROOT_DIR, './build/generic-extension-wip');
const SOURCE_DIRECTORY = path.resolve(ROOT_DIR, './extension');
const BUILD_DIRECTORY = path.resolve(ROOT_DIR, './build');

// Helper: execute a command in a specified directory.
const runCmd = (cmd, cwdName = 'default') => {
  const safeDirs = {
    default: ROOT_DIR,
    conf: path.join(ROOT_DIR, 'conf'),
  };

  const cwd = safeDirs[cwdName];
  if (!cwd) throw new Error('Invalid working directory requested');

  return new Promise((resolve, reject) => {
    const child = spawn(cmd, { stdio: 'inherit', cwd, shell: true });
    child.on('error', reject);
    child.on('close', (code, signal) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${signal || code}): ${cmd}`));
    });
  });
};

/**
 * Synchronize specified file types from source to output directories
 */
const synchronizeFiles = async destDir => {
  const pattern = '**/*.{js,mjs,htm,css,woff2,png,svg,txt}';
  const entries = await Array.fromAsync(glob(pattern, { cwd: SOURCE_DIRECTORY, withFileTypes: true }));
  await Promise.all(
    entries.map(async entry => {
      const source = path.join(entry.parentPath, entry.name);
      if (entry.isFile() || (entry.isSymbolicLink() && fs.statSync(source, { throwIfNoEntry: false })?.isFile())) {
        await cp(source, path.join(destDir, path.relative(SOURCE_DIRECTORY, source)), { verbatimSymlinks: true });
      }
    })
  );
};

/**
 *
 * @param {boolean} useOurCompiler  true for custom compiler, false for default TypeScript compiler
 * @param {string} config  Path to the TypeScript configuration file
 * @param {boolean} incremental Enable incremental build if true
 * @param {string} buildInfo Path to the TypeScript build info file
 */
const buildTS = (useOurCompiler, config, incremental = false, buildInfo = '') => {
  const compiler = useOurCompiler ? `node ${path.join(BUILD_DIRECTORY, 'tooling/tsc-compiler')}` : 'npx tsc';
  const incArgs = incremental ? `--incremental --tsBuildInfoFile ${buildInfo}` : '';
  return runCmd(`${compiler} --project ${config} ${incArgs}`.trim());
};

/**
 * Copy node dependencies explicitly to the build output
 */
const copyDependencies = async () => {
  const deps = [
    ['dompurify/dist/purify.js', 'lib/purify.js'],
    ['jquery/dist/jquery.min.js', 'lib/jquery.min.js'],
    ['openpgp/dist/openpgp.js', 'lib/openpgp.js'],
    ['openpgp/dist/openpgp.min.mjs', 'lib/openpgp.min.mjs'],
    ['linkifyjs/dist/linkify.min.js', 'lib/linkify.min.js'],
    ['linkify-html/dist/linkify-html.min.js', 'lib/linkify-html.min.js'],
    ['sweetalert2/dist/sweetalert2.js', 'lib/sweetalert2.js'],
    ['sweetalert2/dist/sweetalert2.css', 'css/sweetalert2.css'],
    ['@zxcvbn-ts/core/dist/zxcvbn-ts.js', 'lib/zxcvbn-ts.js'],
    ['@zxcvbn-ts/language-common/dist/zxcvbn-ts.js', 'lib/zxcvbn-language-common.js'],
    ['@zxcvbn-ts/language-en/dist/zxcvbn-ts.js', 'lib/zxcvbn-language-en.js'],
    ['squire-rte/dist/squire.js', 'lib/squire.js'],
    ['@flowcrypt/fine-uploader/fine-uploader/fine-uploader.js', 'lib/fine-uploader.js'],
    ['filesize/dist/filesize.js', 'lib/filesize.js'],
    // Using legacy build due to Puppeteer compatibility issue (Promise.withResolvers error)
    // Reference: https://github.com/mozilla/pdf.js/issues/18006#issuecomment-2078739672
    ['pdfjs-dist/legacy/build/pdf.min.mjs', 'lib/pdf.min.mjs'],
    ['pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'lib/pdf.worker.min.mjs'],
    ['bootstrap/dist/js/bootstrap.min.js', 'lib/bootstrap/bootstrap.min.js'],
    ['bootstrap/dist/css/bootstrap.min.css', 'lib/bootstrap/bootstrap.min.css'],
  ];

  await Promise.all(deps.map(([src, dest]) => cp(path.join(ROOT_DIR, 'node_modules', src), path.join(OUTPUT_DIRECTORY, dest), { verbatimSymlinks: true })));

  fs.cpSync(path.join(ROOT_DIR, 'node_modules/@openpgp/web-stream-tools/lib/'), path.join(OUTPUT_DIRECTORY, 'lib/streams'), {
    recursive: true,
    verbatimSymlinks: true,
  });
};

// Perform regex replacements for compatibility patches
const applyRegexReplace = (regex, replacement, files) => {
  for (const file of files) {
    const filePath = path.resolve(file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content);
  }
};

// Main build process
const main = async () => {
  const args = process.argv.slice(2);

  if (args.includes('--assets-only')) {
    const assetDirs = ['chrome-enterprise', 'chrome-consumer', 'firefox-consumer', 'thunderbird-consumer'].map(dir => path.resolve(BUILD_DIRECTORY, dir));
    await Promise.all(assetDirs.map(synchronizeFiles));
    return;
  }

  if (args.includes('--incremental')) {
    // Remove specific directories for incremental build
    for (const dir of ['firefox-consumer', 'thunderbird-consumer', 'chrome-consumer', 'chrome-enterprise', 'generic-extension-wip/js/content_scripts']) {
      fs.rmSync(path.join(BUILD_DIRECTORY, dir), { recursive: true, force: true });
    }

    fs.mkdirSync(BUILD_DIRECTORY, { recursive: true });
  } else {
    fs.rmSync(BUILD_DIRECTORY, { recursive: true, force: true });
    await runCmd('npx tsc --project ./conf/tsconfig.tooling.json');
    fs.mkdirSync(OUTPUT_DIRECTORY, { recursive: true });
  }

  // These projects write to separate directories. Wait for every compiler before
  // continuing, including on failure, so no compiler is left writing in the background.
  const incremental = args.includes('--incremental');
  const compilations = await Promise.allSettled([
    buildTS(!incremental, './tsconfig.json', incremental, `${BUILD_DIRECTORY}/tsconfig.tsbuildinfo`),
    buildTS(!incremental, './conf/tsconfig.content_scripts.json', incremental, `${BUILD_DIRECTORY}/tsconfig.content_scripts.tsbuildinfo`),
    buildTS(!incremental, './conf/tsconfig.streams.json', incremental, `${BUILD_DIRECTORY}/tsconfig.streams.tsbuildinfo`),
  ]);
  for (const result of compilations) {
    if (result.status === 'rejected') throw result.reason;
  }

  await copyDependencies();

  // patch imports with .js, e.g. replace './streams' with './streams.js'
  // until https://github.com/openpgpjs/web-stream-tools/pull/20 is resolved
  const streamDir = path.join(OUTPUT_DIRECTORY, 'lib/streams');
  const streamFiles = fs
    .readdirSync(streamDir)
    .map(file => path.join(streamDir, file))
    .filter(filePath => fs.statSync(filePath).isFile());

  // patch isUint8Array until https://github.com/openpgpjs/web-stream-tools/pull/23 is resolved
  // First patch: replaces `return Uint8Array.prototype.isPrototypeOf(input);` with fallback to globalThis
  applyRegexReplace(
    /(\s*)return Uint8Array\.prototype\.isPrototypeOf\(input\);/g,
    '$1return Uint8Array.prototype.isPrototypeOf(input) || globalThis.Uint8Array.prototype.isPrototypeOf(input);',
    [...streamFiles, path.join(OUTPUT_DIRECTORY, 'lib/openpgp.js')]
  );

  await runCmd('npx webpack --stats errors-warnings', 'conf');

  // remaining build steps sequentially
  await synchronizeFiles(OUTPUT_DIRECTORY);
  for (const file of ['manifest.json', '.web-extension-id']) {
    fs.cpSync(path.join(SOURCE_DIRECTORY, file), path.join(OUTPUT_DIRECTORY, file), { verbatimSymlinks: true });
  }

  for (const cmd of ['resolve-modules --project ./tsconfig.json', 'fill-values', 'bundle-content-scripts']) {
    await runCmd(`node ${path.join(BUILD_DIRECTORY, 'tooling', cmd)}`);
  }

  for (const dir of ['chrome-enterprise', 'chrome-consumer', 'firefox-consumer', 'thunderbird-consumer']) {
    fs.cpSync(OUTPUT_DIRECTORY, path.join(BUILD_DIRECTORY, dir), { recursive: true, verbatimSymlinks: true });
  }

  await runCmd(`node ${path.join(BUILD_DIRECTORY, 'tooling', 'build-types-and-manifests')}`);
  console.log('✅ Build completed successfully.');
};

main().catch(err => {
  console.error('❌ Error during build:', err);
  process.exit(1);
});
