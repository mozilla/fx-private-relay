module.exports = {
  "frontend/**/*.{scss,css}": "stylelint --fix",
  "frontend/**/*.{ts,tsx,js,jsx,scss,css}": "prettier --write",
  "e2e-tests/**/*.ts": "prettier --write",
  "frontend/**/*.{ts,tsx,js,jsx}": (filenames) =>
    `eslint --fix ${filenames.join(" ")}`,
  "*.md": "prettier --write",
  "*.py": ["black", "mypy", "ruff check --fix"],
}
