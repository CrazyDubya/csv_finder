module.exports = {
  env: {
    browser: true,
    es2021: true,
    node: true,
    jest: true
  },
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'script'
  },
  globals: {
    d3: 'readonly',
    Fuse: 'readonly',
    _: 'readonly'
  },
  rules: {
    'no-console': 'warn',
    'no-unused-vars': ['error', { 'args': 'none' }],
    'no-undef': 'error',
    'semi': ['error', 'always'],
    'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
    'indent': ['error', 2],
    'no-trailing-spaces': 'error',
    'eol-last': 'error'
  },
  ignorePatterns: [
    'd3-csv.js',
    'fuse.js',
    'csv-worker.js',
    'worker.js',
    'temp_script.js',
    'node_modules/**',
    'coverage/**',
    'playwright-report/**',
    'test-results/**'
  ]
};