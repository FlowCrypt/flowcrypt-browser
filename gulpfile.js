
let gulp = require('gulp');
let newer = require('gulp-newer');
let typescript = require('gulp-typescript');
var sourcemaps = require('gulp-sourcemaps');
var jeditor = require("gulp-json-editor");
let fs = require('fs');
let del = require('del');
let exec = require('child_process').exec;

let config = (path) => JSON.parse(fs.readFileSync(path));
let source = (path) => Array.isArray(path) ? path.map(source) : `chrome/${path}`;
let version = config('package.json').version;

let chromeTo = 'build/chrome';
let ffTo = 'build/firefox';

let recipe = {
  crash: (reason='ending build process due to previous errors') => {
    return function() {
      this.once("finish", () => { 
        console.error(`***** ${reason} *****`);
        process.exit(1);
      });
    }
  },
  ts: (from, to) => gulp.src(from).pipe(sourcemaps.init()).pipe(typescript(config('tsconfig.json').compilerOptions)).on('error', recipe.crash()).pipe(sourcemaps.write()).pipe(gulp.dest(to)),
  copy: (from, to) => gulp.src(from).pipe(gulp.dest(to)),
  exec: (shell_command) => new Promise((resolve, reject) => {
    let subprocess = exec(shell_command, (err, stdout, stderr) => err === null ? resolve() : reject(err));
    subprocess.stdout.pipe(process.stdout);
    subprocess.stderr.pipe(process.stderr);
  }),
  copyEditJson: (from, to, json_processor) => gulp.src(from).pipe(jeditor(json_processor)).pipe(gulp.dest(to)),
}

let subTask = {
  flush: () => Promise.all([del(chromeTo), del(ffTo)]),
  transpileProjectTs: () => recipe.ts(source('**/*.ts') ,chromeTo),
  copySourceFiles: () => recipe.copy(source(['**/*.js', '**/*.htm', '**/*.css', '**/*.ttf', '**/*.png', '**/*.svg', '**/*.txt', '.web-extension-id']), chromeTo),
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
  buildTest: () => recipe.ts('test/test.ts', 'test/'),
  runTest: () => recipe.exec('node test/test.js'),
}

let task = {
  build: gulp.series(
    subTask.flush,
    gulp.parallel(
      subTask.transpileProjectTs, 
      subTask.copySourceFiles,
      subTask.copyVersionedManifest,
    ),
    subTask.copyChromeToFirefox,
    subTask.copyChromeToFirefoxEditedManifest,
  ),
  test: gulp.series(
    subTask.buildTest,
    subTask.runTest,
  ),
}

gulp.task('default', task.build);
gulp.task('test', gulp.series(task.build, task.test));
