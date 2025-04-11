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
const copyDependencies = () => {
  const deps = [
    ['dompurify/dist/purify.js', 'lib/purify.js'],
    ['jquery/dist/jquery.min.js', 'lib/jquery.min.js'],
    ['openpgp/dist/openpgp.js', 'lib/openpgp.js'],
    ['openpgp/dist/openpgp.min.mjs', 'lib/openpgp.min.mjs'],
    ['linkifyjs/dist/linkify.min.js', 'lib/linkify.min.js'],
    ['linkify-html/dist/linkify-html.min.js', 'lib/linkify-html.min.js'],
    ['sweetalert2/dist/sweetalert2.js', 'lib/sweetalert2.js'],
    ['sweetalert2/dist/sweetalert2.css', 'css/sweetalert2.css'],
    ['iso-8859-2/iso-8859-2.js', 'lib/iso-8859-2.js'],
    ['zxcvbn/dist/zxcvbn.js', 'lib/zxcvbn.js'],
    ['squire-rte/dist/squire.js', 'lib/squire.js'],
    ['clipboard/dist/clipboard.js', 'lib/clipboard.js'],
    ['@flowcrypt/fine-uploader/fine-uploader/fine-uploader.js', 'lib/fine-uploader.js'],
    ['filesize/dist/filesize.js', 'lib/filesize.js'],
    // Using legacy build due to Puppeteer compatibility issue (Promise.withResolvers error)
    // Reference: https://github.com/mozilla/pdf.js/issues/18006#issuecomment-2078739672
    ['pdfjs-dist/legacy/build/pdf.min.mjs', 'lib/pdf.min.mjs'],
    ['pdfjs-dist/legacy/build/pdf.worker.min.mjs', 'lib/pdf.worker.min.mjs'],
    ['bootstrap/dist/js/bootstrap.min.js', 'lib/bootstrap/bootstrap.min.js'],
    ['bootstrap/dist/css/bootstrap.min.css', 'lib/bootstrap/bootstrap.min.css'],
  ];

  deps.forEach(([src, dest]) => fs.copySync(path.join(ROOT_DIR, 'node_modules', src), path.join(OUTPUT_DIRECTORY, dest)));

  fs.copySync(path.join(ROOT_DIR, 'node_modules/@openpgp/web-stream-tools/lib/'), path.join(OUTPUT_DIRECTORY, 'lib/streams'));
};

// Perform regex replacements for compatibility patches
const applyRegexReplace = (regex, replacement, files) => {
  files.forEach(file => {
    const filePath = path.resolve(file);
    let content = fs.readFileSync(filePath, 'utf8');
    content = content.replace(regex, replacement);
    fs.writeFileSync(filePath, content);
  });
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
    ['firefox-consumer', 'thunderbird-consumer', 'chrome-consumer', 'chrome-enterprise', 'generic-extension-wip/js/content_scripts'].forEach(dir =>
      fs.removeSync(path.join(BUILD_DIRECTORY, dir))
    );

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

  copyDependencies();

  // patch imports with .js, e.g. replace './streams' with './streams.js'
  // until https://github.com/openpgpjs/web-stream-tools/pull/20 is resolved
  const streamDir = path.join(OUTPUT_DIRECTORY, 'lib/streams');
  const streamFiles = fs.readdirSync(streamDir).map(file => path.join(streamDir, file));
  applyRegexReplace(/'(.\/(streams|util|writer|reader|node-conversions))'/g, "'$1.js'", streamFiles);

  // patch isUint8Array until https://github.com/openpgpjs/web-stream-tools/pull/23 is resolved
  // First patch: replaces `return Uint8Array.prototype.isPrototypeOf(input);` with fallback to globalThis
  applyRegexReplace(
    /(\s*)return Uint8Array\.prototype\.isPrototypeOf\(input\);/g,
    '$1return Uint8Array.prototype.isPrototypeOf(input) || globalThis.Uint8Array.prototype.isPrototypeOf(input);',
    [...streamFiles, path.join(OUTPUT_DIRECTORY, 'lib/openpgp.js')]
  );

  // the following patches are until https://github.com/openpgpjs/openpgpjs/issues/1648 is fixed

  // handles patterns like (n instanceof Uint8Array) or (arguments[i] instanceof Uint8Array)
  // to replace them with (n instanceof Uint8Array || n instanceof globalThis.Uint8Array)
  applyRegexReplace(/\(([^()\s]+) instanceof Uint8Array\)/g, '($1 instanceof Uint8Array || $1 instanceof globalThis.Uint8Array)', [
    path.join(OUTPUT_DIRECTORY, 'lib/openpgp.js'),
  ]);

  // handles direct `return something instanceof Uint8Array;` expressions
  applyRegexReplace(/return ([^()\s]+) instanceof Uint8Array;/g, 'return ($1 instanceof Uint8Array || $1 instanceof globalThis.Uint8Array);', [
    path.join(OUTPUT_DIRECTORY, 'lib/openpgp.js'),
  ]);

  runCmd('npx webpack', 'conf');

  // to update node-forge library, which is missing the non-minified version in dist, we have to build it manually
  // cd ~/git && rm -rf ./forge && git clone https://github.com/digitalbazaar/forge.git && cd ./forge && npm install && npm run-script build
  // cp dist/forge.js ../flowcrypt-browser/extension/lib/forge.js
  // WARN: the steps above are not working as of forge 0.10.0 due to eval/CSP mentioned here: https://github.com/digitalbazaar/forge/issues/814

  // remaining build steps sequentially
  await synchronizeFiles(OUTPUT_DIRECTORY);
  ['manifest.json', '.web-extension-id'].forEach(file => fs.copySync(path.join(SOURCE_DIRECTORY, file), path.join(OUTPUT_DIRECTORY, file)));

  ['resolve-modules --project ./tsconfig.json', 'fill-values', 'bundle-content-scripts'].forEach(cmd =>
    runCmd(`node ${path.join(BUILD_DIRECTORY, 'tooling', cmd)}`)
  );

  ['chrome-enterprise', 'chrome-consumer', 'firefox-consumer', 'thunderbird-consumer'].forEach(dir =>
    fs.copySync(OUTPUT_DIRECTORY, path.join(BUILD_DIRECTORY, dir))
  );

  runCmd(`node ${path.join(BUILD_DIRECTORY, 'tooling', 'build-types-and-manifests')}`);
  console.log('✅ Build completed successfully.');
};

main().catch(err => {
  console.error('❌ Error during build:', err);
  process.exit(1);
});
