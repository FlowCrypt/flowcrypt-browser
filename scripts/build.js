/* ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com */
const fs = require('fs-extra');
const path = require('path');
const { execSync } = require('child_process');

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

  execSync(cmd, { stdio: 'inherit', cwd });
};

/**
 * Synchronize specified file types from source to output directories
 */
const synchronizeFiles = async destDir => {
  const { globby } = await import('globby');
  const patterns = ['**/*.{js,mjs,htm,css,woff2,png,svg,txt}'];
  const files = await globby(patterns, { cwd: SOURCE_DIRECTORY });
  await Promise.all(files.map(file => fs.copy(path.join(SOURCE_DIRECTORY, file), path.join(destDir, file))));
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
  runCmd(`${compiler} --project ${config} ${incArgs}`.trim());
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

  await Promise.all(deps.map(([src, dest]) => fs.copy(path.join(ROOT_DIR, 'node_modules', src), path.join(OUTPUT_DIRECTORY, dest))));

  fs.copySync(path.join(ROOT_DIR, 'node_modules/@openpgp/web-stream-tools/lib/'), path.join(OUTPUT_DIRECTORY, 'lib/streams'));
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
      fs.removeSync(path.join(BUILD_DIRECTORY, dir));
    }

    fs.ensureDirSync(BUILD_DIRECTORY);
    buildTS(false, './tsconfig.json', true, `${BUILD_DIRECTORY}/tsconfig.tsbuildinfo`);
    buildTS(false, './conf/tsconfig.content_scripts.json', true, `${BUILD_DIRECTORY}/tsconfig.content_scripts.tsbuildinfo`);
    buildTS(false, './conf/tsconfig.streams.json', true, `${BUILD_DIRECTORY}/tsconfig.streams.tsbuildinfo`);
  } else {
    fs.removeSync(BUILD_DIRECTORY);
    runCmd('npx tsc --project ./conf/tsconfig.tooling.json');
    fs.ensureDirSync(OUTPUT_DIRECTORY);
    buildTS(true, './tsconfig.json');
    buildTS(true, './conf/tsconfig.content_scripts.json');
    buildTS(true, './conf/tsconfig.streams.json');
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

  runCmd('npx webpack', 'conf');

  // to update node-forge library, which is missing the non-minified version in dist, we have to build it manually
  // cd ~/git && rm -rf ./forge && git clone https://github.com/digitalbazaar/forge.git && cd ./forge && npm install && npm run-script build
  // cp dist/forge.js ../flowcrypt-browser/extension/lib/forge.js
  // WARN: the steps above are not working as of forge 0.10.0 due to eval/CSP mentioned here: https://github.com/digitalbazaar/forge/issues/814

  // remaining build steps sequentially
  await synchronizeFiles(OUTPUT_DIRECTORY);
  for (const file of ['manifest.json', '.web-extension-id']) {
    fs.copySync(path.join(SOURCE_DIRECTORY, file), path.join(OUTPUT_DIRECTORY, file));
  }

  for (const cmd of ['resolve-modules --project ./tsconfig.json', 'fill-values', 'bundle-content-scripts']) {
    runCmd(`node ${path.join(BUILD_DIRECTORY, 'tooling', cmd)}`);
  }

  for (const dir of ['chrome-enterprise', 'chrome-consumer', 'firefox-consumer', 'thunderbird-consumer']) {
    fs.copySync(OUTPUT_DIRECTORY, path.join(BUILD_DIRECTORY, dir));
  }

  runCmd(`node ${path.join(BUILD_DIRECTORY, 'tooling', 'build-types-and-manifests')}`);
  console.log('✅ Build completed successfully.');
};

main().catch(err => {
  console.error('❌ Error during build:', err);
  process.exit(1);
});
