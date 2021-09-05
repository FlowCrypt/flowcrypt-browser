module.exports = {
  parser: '@typescript-eslint/parser',
  env: {
    browser: true,
    node: true,
    commonjs: true,
    es6: true
  },
  globals: {
    '$': false,
    'chrome': false,
    'OpenPGP': false
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/base'
    // 'plugin:@typescript-eslint/recommended'
  ],
  plugins: [
    'no-only-tests',
    'header'
  ],
  rules: {
    '@typescript-eslint/no-unused-vars': ['error'],
    'indent': ['error', 2, { SwitchCase: 1 }],
    'max-len': ['error', { code: 190 }],
    'semi': 'error',
    'no-constant-condition': 0,
    'no-prototype-builtins': 0,
    'no-unused-vars': 0,
    'no-useless-escape': 0,
    'no-only-tests/no-only-tests': ['error', { block: ['ava.default'] }],
    'require-atomic-updates': 0,
    'no-empty-pattern': 0,
    'no-fallthrough': 0,
    'no-undef': 0,
    'no-control-regex': 0,
    'sort-imports': ['off', {
      "ignoreCase": false,
      "ignoreDeclarationSort": false,
      "ignoreMemberSort": false,
      "memberSyntaxSortOrder": ["none", "all", "multiple", "single"]
    }],
    'space-before-blocks': ['error', 'always'],
  },
  overrides: [
    {
      'files': ['./extension/**/*.ts', './test/**/*.ts'],
      'rules': {
        'header/header': ['error', 'block', ' ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com ']
      }
    }
  ]
};
