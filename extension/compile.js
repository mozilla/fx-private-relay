const fs = require("fs");
const { Liquid } = require("liquidjs");
const version = require("./package.json").version;

const FILES = [
  "./manifest.json",
  "./popup.html",
  "./js/background.js"
];

const engine = new Liquid({
  globals: {
    host: process.env.HOST || "http://127.0.0.1",
    port: process.env.PORT || "",
    version,
  },
});

for (const file of FILES) {
  const output = engine.renderFileSync(`${file}.liquid`);
  fs.writeFileSync(file, output);
}
