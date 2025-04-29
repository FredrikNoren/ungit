import js from '@eslint/js';
import globals from 'globals';
import mochaPlugin from 'eslint-plugin-mocha';
import nodePlugin from 'eslint-plugin-n';
import prettierPlugin from 'eslint-plugin-prettier/recommended';

export default [
  {
    ignores: ['public/js', '**/*.bundle.js'],
  },

  js.configs.recommended,
  mochaPlugin.configs.recommended,
  nodePlugin.configs['flat/recommended'],
  prettierPlugin,

  // components
  {
    files: ['components/**'],

    languageOptions: {
      globals: {
        ...globals.browser,
        ungit: 'readonly',
      },
    },

    rules: {
      'n/no-missing-require': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },

  // public/source
  {
    files: ['public/source/**'],

    languageOptions: {
      globals: {
        ...globals.browser,
        io: 'readonly',
        jQuery: 'writable',
        Raven: 'readonly',
        ungit: 'readonly',
      },
    },

    rules: {
      'n/no-missing-require': 'off',
      'n/no-unsupported-features/node-builtins': 'off',
    },
  },

  // public/main.js
  {
    files: ['public/main.js'],

    rules: {
      'n/no-unpublished-require': [
        'error',
        {
          allowModules: ['electron'],
        },
      ],
    },
  },

  // source
  {
    files: ['source/**'],

    rules: {
      'no-control-regex': 'off',
      'n/no-process-exit': 'off',
    },
  },

  // test
  {
    files: ['test/**'],

    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },

    rules: {
      'mocha/no-mocha-arrows': 'off',
    },
  },

  // clicktests
  {
    files: ['clicktests/**'],

    languageOptions: {
      globals: {
        ...globals.browser,
        ungit: 'readonly',
      },
    },

    rules: {
      'mocha/no-mocha-arrows': 'off',
      'mocha/no-setup-in-describe': 'off',
    },
  },

  // eslint.config.mjs
  {
    files: ['eslint.config.mjs'],

    languageOptions: {
      sourceType: 'module',
    },
  },
];
