
let gulp = require('gulp');
let gulpNewer = require('gulp-newer');
let del = require('del');
let gulpTypeScript = require('gulp-typescript');
let fs = require('fs');
let exec = require('child_process').exec;

let config = (path) => JSON.parse(fs.readFileSync(path));
let source = (path) => Array.isArray(path) ? path.map(source) : `chrome/${path}`;

let destination = 'build/chrome';
let toCopy = ['**/*.js', '**/*.htm', '**/*.css', '**/*.ttf', '**/*.png', '**/*.svg', '.web-extension-id', 'changelog.txt', 'manifest.json'];

let subTask = {
  flush: () => del(destination),
  transpileProjectTs: () => gulp.src(source('**/*.ts')).pipe(gulpTypeScript(config('tsconfig.json').compilerOptions)).pipe(gulp.dest(destination)),
  copySourceFiles: () => gulp.src(source(toCopy)).pipe(gulp.dest(destination)),
  buildTest: () => gulp.src('test/test.ts').pipe(gulpTypeScript(config('tsconfig.json').compilerOptions)).pipe(gulp.dest('test/')),
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
