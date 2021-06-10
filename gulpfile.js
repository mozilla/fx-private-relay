const gulp = require('gulp');
const sass = require('gulp-sass');
const del = require('del');
const merge = require('merge-stream');

// directory for building LESS, SASS, and bundles
const buildDir = 'static/scss/libs/';
const finalDir = 'static/css/';

// Compile all SASS/SCSS into => app.scss
gulp.task('styles', () => {
    return gulp.src('static/scss/app.scss')
        .pipe(sass().on('error', sass.logError))
        .pipe(gulp.dest(finalDir));
});

// Clean out compiled CSS folder
gulp.task('clean', () => {
    return del([
        finalDir
    ]);
});

// On setup, remove 
gulp.task('setup', () => {
    return del([
        finalDir,
        buildDir,
    ]);
});

function assetsCopy() {
    return merge([
        // SASS and LESS go to build dir
        gulp.src([
            '!node_modules/@mozilla-protocol/core/*',
            'node_modules/@mozilla-protocol/core/**/*',
            ])
            .pipe(gulp.dest(buildDir)),
    ]);
}

const buildTask = gulp.series([
    'setup',
    assetsCopy,
    'styles',
]);

gulp.task('build', buildTask);

gulp.task('default', async () => {
    // Build on first run
    gulp.series(buildTask);
    
    // Watch for SCSS changes
    gulp.watch('static/scss/**/*.scss', (done) => {
        gulp.series(['clean', 'styles'])(done);
    });
});
