/* eslint-env node */
module.exports = {
  "*.{js,jsx,ts,tsx}": ["eslint --fix"],
  "*.css": ["stylelint --fix"],
  "*.{js,jsx,ts,tsx,css,md,json}": ["prettier --write"],
};
