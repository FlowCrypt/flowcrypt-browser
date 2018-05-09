
let gulp = require('gulp');
let gulpNewer = require('gulp-newer');
let del = require('del');
let gulpTypeScript = require('gulp-typescript');
let fs = require('fs');
let exec = require('child_process').exec;

let config = (path) => JSON.parse(fs.readFileSync(path));
let source = (path) => Array.isArray(path) ? path.map(source) : `chrome/${path}`;

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
  ts: (from, to) => gulp.src(from).pipe(gulpTypeScript(config('tsconfig.json').compilerOptions)).on('error', recipe.crash()).pipe(gulp.dest(to)),
  copy: (from, to) => gulp.src(from).pipe(gulp.dest(to)),
}

let subTask = {
  flush: () => del(target),
  transpileProjectTs: () => recipe.ts(source('**/*.ts') ,target),
  copySourceFiles: () => recipe.copy(source(['**/*.js', '**/*.htm', '**/*.css', '**/*.ttf', '**/*.png', '**/*.svg', '**/*.txt', '.web-extension-id', 'manifest.json']), target),
  buildTest: () => recipe.ts('test/test.ts', 'test/'),
  runTest: (done) => {
    let test = exec('node test/test.js', (err, stdout, stderr) => done());
    test.stdout.pipe(process.stdout);
    test.stderr.pipe(process.stderr);
  },
}

let task = {
  build: gulp.series(
    subTask.flush,
    gulp.parallel(
      subTask.transpileProjectTs, 
      subTask.copySourceFiles,
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
