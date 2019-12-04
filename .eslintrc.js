module.exports = {
  parser: '@typescript-eslint/parser',
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/base'
    // 'plugin:@typescript-eslint/recommended'
  ],
  plugins: [
    'no-only-tests'
  ],
  rules: {
    'semi': 'error',
    'no-useless-escape': 0,
    'no-only-tests/no-only-tests': ['error', { block: ['ava.default'] }]
  }
}
