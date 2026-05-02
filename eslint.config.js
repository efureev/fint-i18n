import antfu from '@antfu/eslint-config'
import globals from 'globals'

export default antfu(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'playground/**',
      'docs/**',
      '**/*.md',
      '**/*.md/**',
    ],
    markdown: false,
    vue: {
      vueVersion: 3,
    },
    typescript: {
      tsconfigPath: 'tsconfig.json',
    },
    jsonc: false,
    yaml: false,
    unocss: false,
    // Formatting is handled by IDE/tools.
    stylistic: false,
  },
  {
    settings: {
      unocss: {
        configPath: './playground/uno.config.ts',
      },
    },
    rules: {
      // Keep dev UX sane; sorting can be handled by IDE.
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'perfectionist/sort-exports': 'off',

      // Import ordering is already handled by the editor; keep lint signal focused.
      'import/first': 'off',

      // Not critical for this repo right now; avoid mass refactors.
      'test/prefer-lowercase-title': 'off',
      'import/consistent-type-specifier-style': 'off',
      'node/prefer-global/process': 'off',

      // Vue formatting rules can create a lot of noise in SFC templates.
      'vue/block-order': 'off',
      'vue/define-macros-order': 'off',
      'vue/html-indent': 'off',
      'vue/no-useless-v-bind': 'off',
      'vue/no-template-shadow': 'off',

      // TS strictness: keep useful checks, but disable the ones that would require large rewrites.
      'ts/no-unsafe-member-access': 'off',
      'ts/no-unsafe-assignment': 'off',
      'ts/no-unsafe-argument': 'off',
      'ts/no-unsafe-call': 'off',
      'ts/no-unsafe-return': 'off',
      'ts/promise-function-async': 'off',
      'ts/strict-boolean-expressions': 'off',
      'ts/consistent-type-definitions': 'off',

      // Regex linting is valuable, but we don't want it blocking right now.
      'e18e/prefer-spread-syntax': 'off',
      'e18e/prefer-static-regex': 'off',
      'regexp/no-super-linear-backtracking': 'off',
      'regexp/prefer-w': 'off',
      'regexp/use-ignore-case': 'off',

      // This is a DS repo; console logs are sometimes useful.
      'no-console': 'off',

      // Keep, but don't block.
      'unused-imports/no-unused-imports': 'warn',

      // UnoCSS ordering is nice-to-have, but should not block.
      'unocss/order': 'off',
    },
    languageOptions: {
      sourceType: 'module',
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
  },
)
