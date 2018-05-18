
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

let target = 'build/chrome';

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
  flush: () => del(target),
  transpileProjectTs: () => recipe.ts(source('**/*.ts') ,target),
  copySourceFiles: () => recipe.copy(source(['**/*.js', '**/*.htm', '**/*.css', '**/*.ttf', '**/*.png', '**/*.svg', '**/*.txt', '.web-extension-id']), target),
  copyEditManifest: () => recipe.copyEditJson(source('manifest.json'), target, (manifest) => {
    manifest.version = version;
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
      subTask.copyEditManifest,
    ),
    // gulp.chromeToFirefox,
  ),
  test: gulp.series(
    subTask.buildTest,
    subTask.runTest,
  ),
}

gulp.task('default', task.build);
gulp.task('test', gulp.series(task.build, task.test));
