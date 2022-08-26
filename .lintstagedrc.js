module.exports = {
  "frontend/**/*.{scss,css}": "stylelint --fix",
  "frontend/**/*.{ts,tsx,js,jsx,scss,css}": "prettier --write",
  "frontend/**/*.{ts,tsx,js,jsx}": (filenames) =>
    `next lint frontend --fix --file ${filenames
      .map((file) => file.split(process.cwd())[1])
      .join(" --file ")}`,
  "*.md": "prettier --write",
  "*.py": ["black", "mypy"],
}
