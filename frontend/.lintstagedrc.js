module.exports = {
  "*.{scss,css}": "stylelint --fix",
  "*.{ts,tsx,js,jsx,scss,css,md}": "prettier --write",
  "*.{ts,tsx,js,jsx}": (filenames) =>
    `next lint --fix --file ${filenames
      .map((file) => file.split(process.cwd())[1])
      .join(" --file ")}`,
};
