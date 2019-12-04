module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: [
      'tsconfig.json',
      'conf/tsconfig.test.json'
    ]
  },
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true
  },
  extends: [
    'plugin:@typescript-eslint/base'
    // 'plugin:@typescript-eslint/recommended'
  ],
  plugins: [
    'no-only-tests'
  ],
  rules: {
    'semi': 'error',
    'no-only-tests/no-only-tests': ['error', {
      block: ['ava.default']
    }]
  }
}
