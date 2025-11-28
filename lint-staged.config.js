/* eslint-env node */
const path = require("path");
const formatCommand = "prettier . --check";

module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --fix"],
  "*.{css,scss}": ["stylelint --fix"],
  "*.{js,jsx,ts,tsx,css,scss,md,json}": ["prettier --write"],
};
