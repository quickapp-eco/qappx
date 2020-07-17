module.exports = {
  env: {
    commonjs: true,
    es6: true
  },
  extends: ["airbnb-base"],
  parserOptions: {
    ecmaVersion: 2019
  },
  rules: {
    "no-underscore-dangle": [0],
    "no-param-reassign": [0],
    "consistent-return": [0],
    "class-methods-use-this": [0],
    "func-names": [2, "as-needed"],
    "no-use-before-define": [2, { "functions": false }],
    "no-console": [2, { allow: ["warn", "error"] }] 
  }
};
