const { src, watch, series, dest } = require("gulp");
const sass = require("gulp-sass");
const del = require("del");

// directory for building LESS, SASS, and bundles
const buildDir = "static/scss/libs/protocol/";
const finalDir = "static/css/";

function clean(cb) {
    del([
        finalDir
    ]);
    cb();
}

function reset(cb) {
    del([
        finalDir,
        buildDir,
    ]);
    cb();
}

function styles(cb) {
    src("static/scss/app.scss")
        .pipe(sass().on("error", sass.logError))
        .pipe(dest(finalDir));

    cb();
}

function assetsCopy(cb) {
    src(["node_modules/@mozilla-protocol/core/protocol/**/*"]).pipe(dest(buildDir));
    cb();
}

exports.build = series(reset, assetsCopy, styles);

exports.default = series(
    clean, assetsCopy, styles, function() {
        // You can use a single task
        watch("static/scss/**/*.scss", { ignoreInitial: false }, series(clean, styles));
    }
);