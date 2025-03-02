import globals from 'globals';

export default [
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        ...globals.browser,  // Properly include all browser globals
        ...globals.es2021,   // Include ES2021 globals
        THREE: 'readonly'    // Custom globals from original config
      }
    },
    rules: {
      // Recommended rules (equivalent to extends: 'eslint:recommended')
      'no-const-assign': 'error',
      'no-this-before-super': 'error',
      'no-undef': 'error',
      'no-unreachable': 'error',
      'no-unused-vars': ['warn'],
      'constructor-super': 'error',
      'valid-typeof': 'error',

      // Custom rules from original config
      'linebreak-style': ['error', 'unix'],
      'quotes': ['error', 'single', { 'allowTemplateLiterals': true }],
      'semi': ['error', 'always'],
      'no-multiple-empty-lines': ['error', { 'max': 2 }],
      'no-trailing-spaces': 'error',
      'eqeqeq': ['error', 'always']
    }
  }
];
