
// @ts-check

let gulp = require('gulp');
let jeditor = require("gulp-json-editor");
let fs = require('fs');
let exec = require('child_process').exec;
let inquirer = require('inquirer');
var replace = require('gulp-replace');

let config = (path) => JSON.parse(fs.readFileSync(path).toString());
let source = (path) => Array.isArray(path) ? path.map(source) : `../extension/${path}`;
let version = config('../package.json').version;

let CHROME_CONSUMER = 'chrome-consumer';
let CHROME_ENTERPRISE = 'chrome-enterprise';
let FIREFOX_CONSUMER = 'firefox-consumer';

const buildDir = (buildType) => `../build/${buildType}`;
const releaseZip = (buildType) => `../release/${buildType}/flowcrypt-${buildType}-${version.replace(/\./g, '-')}.zip`;

let recipe = {
  crash: (reason = 'ending build process due to previous errors') => {
    return function () {
      this.once("finish", () => {
        console.error(`***** ${reason} *****`);
        process.exit(1);
      });
    }
  },
  copy: (from, to) => gulp.src(from).pipe(gulp.dest(to)),
  exec: (shell_command) => new Promise((resolve, reject) => {
    let subprocess = exec(shell_command, (err, stdout, stderr) => err === null ? resolve() : reject(err));
    subprocess.stdout.pipe(process.stdout);
    subprocess.stderr.pipe(process.stderr);
  }),
  copyEditJson: (from, to, json_processor) => gulp.src(from).pipe(jeditor(json_processor)).pipe(gulp.dest(to)),
  confirm: (keyword) => inquirer.prompt([{ type: 'input', message: `Type "${keyword}" to confirm`, name: 'r' }]).then(q => q.r === keyword ? null : process.exit(1)),
  spacesToTabs: (folder) => gulp.src(`${folder}/**/*.js`)
    .pipe(replace(/}\n\s+(else|catch)/gm, (_, statement) => `} ${statement}`)) // `} catch () {` and `} else {` on the same line
    .pipe(replace(/^( {4})+/gm, (m) => '\t'.repeat(m.length / 4)))
    .pipe(gulp.dest(folder)),
}

let subTask = {
  runTscExtension: () => recipe.exec('node ../build/tooling/tsc-compiler --project ../tsconfig.json'),
  runTscContentScripts: () => recipe.exec('node ../build/tooling/tsc-compiler --project tsconfig.content_scripts.json'),
  copySourceFiles: () => recipe.copy(source(['**/*.js', '**/*.htm', '**/*.css', '**/*.ttf', '**/*.woff2', '**/*.png', '**/*.svg', '**/*.txt', '.web-extension-id']), buildDir(CHROME_CONSUMER)),
  chromeFixOutputWhitespaces: () => Promise.all([
    recipe.spacesToTabs(`${buildDir(CHROME_CONSUMER)}/js`),
    recipe.spacesToTabs(`${buildDir(CHROME_CONSUMER)}/chrome`),
  ]),
  copyVersionedManifest: () => recipe.copyEditJson(source('manifest.json'), buildDir(CHROME_CONSUMER), manifest => {
    manifest.version = version;
    return manifest;
  }),
  copyChromeToFirefox: () => recipe.copy([`${buildDir(CHROME_CONSUMER)}/**`], buildDir(FIREFOX_CONSUMER)),
  copyChromeToFirefoxEditedManifest: () => recipe.copyEditJson(`${buildDir(CHROME_CONSUMER)}/manifest.json`, buildDir(FIREFOX_CONSUMER), manifest => {
    manifest.applications = { gecko: { id: 'firefox@cryptup.io', update_url: 'https://flowcrypt.com/api/update/firefox', strict_min_version: '60.0' } };
    manifest.permissions = manifest.permissions.filter(p => p !== 'unlimitedStorage');
    delete manifest.minimum_chrome_version;
    return manifest;
  }),
  copyChromeToChromeEnterprise: () => recipe.copy([`${buildDir(CHROME_CONSUMER)}/**`], buildDir(CHROME_ENTERPRISE)),
  copyChromeToChromeEnterpriseEditedManifest: () => recipe.copyEditJson(`${buildDir(CHROME_CONSUMER)}/manifest.json`, buildDir(CHROME_ENTERPRISE), manifest => {
    manifest.name = 'FlowCrypt for Enterprise';
    manifest.description = 'FlowCrypt Chrome Extension for Enterprise clients (stable)';
    // do not change!! or all user extensions will be disabled in their browser waiting for a new prompt
    manifest.permissions = ["storage", "tabs", "https://*.google.com/*", "https://*.flowcrypt.com/*", "unlimitedStorage"];
    for (const csDef of manifest.content_scripts) {
      // do not change!!
      csDef.matches = csDef.matches.filter(host => host === '*://mail.google.com/*' || host === '*://accounts.google.com/o/oauth2/approval*');
    }
    manifest.content_scripts = manifest.content_scripts.filter(csDef => csDef.matches.length); // remove empty defs
    if (!manifest.content_scripts.length) {
      throw new Error('Content script defs ended up empty in enterprise manifest');
    }
    return manifest;
  }),
  releaseChrome: () => recipe.exec(`cd ../build; rm -f ${releaseZip(CHROME_CONSUMER)}; zip -rq ${releaseZip(CHROME_CONSUMER)} ./${CHROME_CONSUMER}/*`),
  releaseChromeEnterprise: () => recipe.exec(`cd ../build; rm -f ${releaseZip(CHROME_ENTERPRISE)}; zip -rq ${releaseZip(CHROME_ENTERPRISE)} ./${CHROME_ENTERPRISE}/*`),
  releaseFirefox: () => recipe.confirm('firefox release').then(() => recipe.exec('../../flowcrypt-script/browser/firefox_release')),
  chromeResolveModules: () => recipe.exec(`node ../build/tooling/resolve-modules`),
  chromeBundleContentScripts: () => recipe.exec(`node ../build/tooling/bundle-content-scripts`),
  chromeFillValues: () => recipe.exec(`node ../build/tooling/fill-values`),
}

let task = {
  build: gulp.series(
    gulp.parallel(
      subTask.runTscExtension,
      subTask.runTscContentScripts,
      subTask.copySourceFiles,
      subTask.copyVersionedManifest,
    ),
    subTask.chromeFixOutputWhitespaces,
    subTask.chromeResolveModules,
    subTask.chromeFillValues,
    subTask.chromeBundleContentScripts,
    gulp.parallel(
      subTask.copyChromeToFirefox,
      subTask.copyChromeToChromeEnterprise,
    ),
    gulp.parallel(
      subTask.copyChromeToFirefoxEditedManifest,
      subTask.copyChromeToChromeEnterpriseEditedManifest,
    ),
  ),
  release: gulp.series(
    subTask.releaseChrome,
    subTask.releaseChromeEnterprise,
    subTask.releaseFirefox,
  ),
}

gulp.task('default', task.build);

gulp.task('release', gulp.series(
  task.build,
  task.release,
));
