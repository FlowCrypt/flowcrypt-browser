// Importing necessary ESLint plugins
import tseslint from 'typescript-eslint';
import noOnlyTestsPlugin from 'eslint-plugin-no-only-tests';
import headerPlugin from 'eslint-plugin-header';
import jsdocPlugin from 'eslint-plugin-jsdoc';
import preferArrowPlugin from 'eslint-plugin-prefer-arrow';
import noNullPlugin from 'eslint-plugin-no-null';
import localRulesPlugin from 'eslint-plugin-local-rules';
import eslintConfigPrettier from 'eslint-config-prettier';
import pluginJs from '@eslint/js';

const commonConfig = {
  plugins: {
    '@typescript-eslint': tseslint.plugin,
    'no-only-tests': noOnlyTestsPlugin,
    header: headerPlugin,
    jsdoc: jsdocPlugin,
    'prefer-arrow': preferArrowPlugin,
    'no-null': noNullPlugin,
    'local-rules': localRulesPlugin,
  },
  languageOptions: {
    parser: tseslint.parser,
    parserOptions: {
      project: true,
    },
  },
  rules: {
    '@typescript-eslint/consistent-indexed-object-style': 'off',
    '@typescript-eslint/consistent-type-assertions': 'error',
    '@typescript-eslint/consistent-type-definitions': 'off',
    '@typescript-eslint/dot-notation': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-member-accessibility': [
      'error',
      {
        accessibility: 'explicit',
      },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/member-ordering': 'error',
    '@typescript-eslint/naming-convention': [
      'error',
      {
        selector: 'default',
        format: ['camelCase'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      {
        selector: 'variable',
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
        trailingUnderscore: 'allow',
      },
      {
        selector: 'typeLike',
        format: ['PascalCase'],
      },
      {
        selector: ['classProperty', 'objectLiteralProperty', 'typeProperty', 'classMethod', 'objectLiteralMethod', 'typeMethod', 'accessor', 'enumMember'],
        format: null,
        modifiers: ['requiresQuotes'],
      },
      {
        selector: ['classProperty'],
        format: ['camelCase', 'UPPER_CASE'],
        leadingUnderscore: 'allow',
      },
      {
        selector: ['import'],
        format: ['camelCase', 'PascalCase'],
      },
    ],
    '@typescript-eslint/no-empty-interface': 'off',
    '@typescript-eslint/no-explicit-any': ['warn'],
    '@typescript-eslint/no-extraneous-class': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-misused-new': 'error',
    '@typescript-eslint/no-namespace': 'off',
    '@typescript-eslint/no-parameter-properties': 'off',
    '@typescript-eslint/no-shadow': 'off',
    '@typescript-eslint/no-unsafe-return': 'error',
    '@typescript-eslint/prefer-nullish-coalescing': 'off',
    '@typescript-eslint/no-unnecessary-condition': 'off',
    '@typescript-eslint/restrict-template-expressions': 'off',
    '@typescript-eslint/restrict-plus-operands': 'off',
    '@typescript-eslint/require-await': 'off',
    '@typescript-eslint/no-confusing-void-expression': 'off',
    '@typescript-eslint/no-misused-promises': 'off',
    '@typescript-eslint/no-redundant-type-constituents': 'off',
    '@typescript-eslint/no-unused-vars': ['error'],
    '@typescript-eslint/no-unused-expressions': 'error',
    '@typescript-eslint/no-use-before-define': 'off',
    '@typescript-eslint/no-var-requires': 'error',
    '@typescript-eslint/prefer-for-of': 'error',
    '@typescript-eslint/prefer-function-type': 'error',
    '@typescript-eslint/prefer-namespace-keyword': 'error',
    '@typescript-eslint/type-annotation-spacing': 'off',
    '@typescript-eslint/typedef': 'off',
    '@typescript-eslint/unbound-method': ['error', { ignoreStatic: true }],
    '@typescript-eslint/unified-signatures': 'error',
    complexity: 'off',
    'constructor-super': 'error',
    'dot-notation': 'error',
    eqeqeq: ['error', 'smart'],
    'guard-for-in': 'error',
    'header/header': ['error', 'block', ' ©️ 2016 - present FlowCrypt a.s. Limitations apply. Contact human@flowcrypt.com '],
    'id-denylist': 'error',
    'id-match': 'error',
    'jsdoc/check-alignment': 'off',
    'jsdoc/check-indentation': 'off',
    'jsdoc/newline-after-description': 'off',
    'max-classes-per-file': 'off',
    'no-bitwise': 'off',
    'no-caller': 'error',
    'no-cond-assign': 'error',
    'no-console': 'off',
    'no-constant-condition': 0,
    'no-control-regex': 0,
    'no-debugger': 'error',
    'no-empty': 'error',
    'no-empty-pattern': 0,
    'no-eval': 'error',
    'no-fallthrough': 0,
    'no-invalid-this': 'off',
    'no-new-wrappers': 'error',
    'no-null/no-null': 'error',
    'no-only-tests/no-only-tests': ['error'],
    'no-prototype-builtins': 0,
    'no-shadow': 'off',
    'no-throw-literal': 'error',
    'no-undef': 0,
    'no-undef-init': 'error',
    'no-underscore-dangle': 'error',
    'no-unsafe-finally': 'error',
    'no-unused-expressions': 'off',
    'no-unused-labels': 'error',
    'no-use-before-define': 'off',
    'no-useless-escape': 0,
    'no-var': 'error',
    'object-shorthand': 'error',
    'one-var': ['off', 'never'],
    'prefer-arrow/prefer-arrow-functions': 'error',
    'prefer-const': [
      'error',
      {
        destructuring: 'all',
      },
    ],
    radix: 'off',
    'require-atomic-updates': 0,
    'sort-imports': 'off',
    'spaced-comment': [
      'error',
      'always',
      {
        markers: ['/'],
      },
    ],
    'local-rules/standard-loops': 'error',
  },
};

export default [
  {
    ignores: ['extension/types/**', 'extension/js/common/core/types/**', 'test/source/core/types/**', 'build/**', 'extension/lib/**', 'eslint.config.js'],
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  eslintConfigPrettier,
  {
    ...commonConfig,
    files: ['extension/**/*.ts'],
    languageOptions: {
      ...commonConfig.languageOptions,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
  },
  {
    ...commonConfig,
    files: ['tooling/**/*.ts'],
    languageOptions: {
      ...commonConfig.languageOptions,
      parserOptions: {
        project: './conf/tsconfig.tooling.json',
      },
    },
  },
  {
    ...commonConfig,
    files: ['test/**/*.ts'],
    languageOptions: {
      ...commonConfig.languageOptions,
      parserOptions: {
        project: './conf/tsconfig.test.eslint.json',
      },
    },
    rules: {
      ...commonConfig.rules,
      '@typescript-eslint/no-unused-expressions': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
    },
  },
  ...tseslint.config({
    files: ['extension/js/content_scripts/webmail/**/*.ts'],
    languageOptions: {
      parserOptions: {
        project: './conf/tsconfig.content_scripts.json',
      },
    },
  }),
];
