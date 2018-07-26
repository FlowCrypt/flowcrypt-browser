
let gulp = require('gulp');
let typescript = require('gulp-typescript');
let sourcemaps = require('gulp-sourcemaps');
let jeditor = require("gulp-json-editor");
let fs = require('fs');
let del = require('del');
let exec = require('child_process').exec;
let inquirer = require('inquirer');
var replace = require('gulp-replace');
let ava = require('gulp-ava');

let config = (path) => JSON.parse(fs.readFileSync(path));
let source = (path) => Array.isArray(path) ? path.map(source) : `chrome/${path}`;
let version = config('package.json').version;

let chromeTo = 'build/chrome';
let ffTo = 'build/firefox';
let chromeReleaseZipTo = `release/flowcrypt-chrome-${version.replace(/\./g, '-')}.zip`;

let recipe = {
  crash: (reason='ending build process due to previous errors') => {
    return function() {
      this.once("finish", () => { 
        console.error(`***** ${reason} *****`);
        process.exit(1);
      });
    }
  },
  // ts: (from, to, configfile) => gulp.src(from).pipe(sourcemaps.init()).pipe(typescript(config(configfile).compilerOptions)).on('error', recipe.crash()).pipe(sourcemaps.write()).pipe(gulp.dest(to)),
  ts: (from, to, configfile) => gulp.src(from).pipe(typescript(config(configfile).compilerOptions)).on('error', recipe.crash()).pipe(gulp.dest(to)),
  copy: (from, to) => gulp.src(from).pipe(gulp.dest(to)),
  exec: (shell_command) => new Promise((resolve, reject) => {
    let subprocess = exec(shell_command, (err, stdout, stderr) => err === null ? resolve() : reject(err));
    subprocess.stdout.pipe(process.stdout);
    subprocess.stderr.pipe(process.stderr);
  }),
  copyEditJson: (from, to, json_processor) => gulp.src(from).pipe(jeditor(json_processor)).pipe(gulp.dest(to)),
  confirm: (keyword) => inquirer.prompt([{type: 'input', message: `Type "${keyword}" to confirm`, name: 'r'}]).then(q => q.r === keyword ? null : process.exit(1)),
  spacesToTabs: (folder) => gulp.src(`${folder}/**/*.js`).pipe(replace(/^( {4})+/gm, (m) => '\t'.repeat(m.length/4))).pipe(gulp.dest(folder)),
  ava: (src) => gulp.src(src).pipe(ava({verbose: true})).on('error', () => process.exit(1)),
}

let subTask = {
  flush: () => Promise.all([del(chromeTo), del(ffTo)]),
  transpileProjectTs: () => recipe.ts(source('**/*.ts') ,chromeTo, 'tsconfig.json'),
  copySourceFiles: () => recipe.copy(source(['**/*.js', '**/*.htm', '**/*.css', '**/*.ttf', '**/*.png', '**/*.svg', '**/*.txt', '.web-extension-id']), chromeTo),
  chromeBuildSpacesToTabs: () => Promise.all([
    recipe.spacesToTabs(`${chromeTo}/js`),
    recipe.spacesToTabs(`${chromeTo}/chrome`),
  ]),
  copyVersionedManifest: () => recipe.copyEditJson(source('manifest.json'), chromeTo, manifest => {
    manifest.version = version;
    return manifest;
  }),
  copyChromeToFirefox: () => recipe.copy([`${chromeTo}/**`], ffTo),
  copyChromeToFirefoxEditedManifest: () => recipe.copyEditJson(`${chromeTo}/manifest.json`, ffTo, manifest => {
    manifest.applications = {gecko: {id: 'firefox@cryptup.io', update_url: 'https://flowcrypt.com/api/update/firefox'}};
    manifest.permissions = manifest.permissions.filter(p => p !== 'unlimitedStorage');
    delete manifest.minimum_chrome_version;
    return manifest;
  }),
  buildTest: () => recipe.ts('test/source/**/*.ts', 'test/build/', 'test/tsconfig.json'),
  // runTest: () => recipe.exec('node test/build/test.js'),
  runTest: () => recipe.ava('test/build/test.js'),
  runFirefox: () => recipe.exec('web-ext run --source-dir ./build/firefox/ --firefox-profile ~/.mozilla/firefox/flowcrypt-dev --keep-profile-changes'),
  releaseChrome: () => recipe.exec(`cd build; rm -f ../${chromeReleaseZipTo}; zip -rq ../${chromeReleaseZipTo} chrome/*`),
  releaseFirefox: () => recipe.confirm('firefox release').then(() => recipe.exec('./../flowcrypt-script/browser/firefox_release')),
}

let task = {
  build: gulp.series(
    subTask.flush,
    gulp.parallel(
      subTask.transpileProjectTs, 
      subTask.copySourceFiles,
      subTask.copyVersionedManifest,
    ),
    subTask.chromeBuildSpacesToTabs,
    subTask.copyChromeToFirefox,
    subTask.copyChromeToFirefoxEditedManifest,
  ),
  test: gulp.series(
    subTask.buildTest,
    subTask.runTest,
  ),
  runFirefox: subTask.runFirefox,
  release: gulp.series(
    subTask.releaseChrome,
    subTask.releaseFirefox,
  ),
}

gulp.task('default', task.build);
gulp.task('test', gulp.series(task.build, task.test));
gulp.task('runFirefox', gulp.series(task.build, task.runFirefox));
gulp.task('release', gulp.series(task.build, task.release));
