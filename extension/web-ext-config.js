/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

 module.exports = {
  // Global options:
  sourceDir: ".",
  verbose: false,

  // Command options:
  build: {
    overwriteDest: true,
  },

  ignoreFiles: [
    ".DS_Store",
    "README.*",
    "package.json",
    "package-lock.json",
    "sequence-diagram.*",
    "web-ext-config.js"
  ],
};
