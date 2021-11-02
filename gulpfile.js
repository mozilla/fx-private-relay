const { src, watch, series, dest } = require("gulp");
const sass = require("gulp-sass")(require("sass"));
const del = require("del");
const sourcemaps = require("gulp-sourcemaps");

// directory for building LESS, SASS, and bundles
const buildDir = "./static/scss/libs/protocol/";
const finalDir = "./static/css/";

function clean() {
    return del([
        finalDir
    ]);
}

function reset() {    
    return del([
        finalDir,
        buildDir,
    ]);
}

function styles() {
    return src("./static/scss/app.scss")
      .pipe(sourcemaps.init())
      .pipe(sass().on("error", sass.logError))
      .pipe(sourcemaps.write("."))
      .pipe(dest(finalDir));
}

function assetsCopy() { 
    return src(["./node_modules/@mozilla-protocol/core/protocol/**/*"]).pipe(dest(buildDir));
}

exports.build = series(reset, assetsCopy, styles);
exports.default = series(
    clean, assetsCopy, styles, function() {
        // You can use a single task
        watch("./static/scss/**/*.scss", { ignoreInitial: false }, series(clean, styles));
    }
);
