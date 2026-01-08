module.exports = {
  "frontend/**/*.{scss,css}": "stylelint --fix",
  "frontend/**/*.{ts,tsx,js,jsx,scss,css}": "prettier --write",
  "e2e-tests/**/*.ts": "prettier --write",
  "frontend/**/*.{ts,tsx,js,jsx}": "eslint --fix --max-warnings=0 --config frontend/.eslintrc.js",
  "*.md": "prettier --write",
  "*.py": ["black", "mypy", "ruff check --fix"],
}
