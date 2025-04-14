import eslint from '@eslint/js';
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript';
import * as importXPlugin from 'eslint-plugin-import-x';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import react from 'eslint-plugin-react';
import * as reactCompiler from 'eslint-plugin-react-compiler';
import * as reactHooks from 'eslint-plugin-react-hooks';
import * as tseslint from 'typescript-eslint';

export default tseslint.config(
  { ignores: ['build/', 'dist/', 'website/'] },
  eslint.configs.recommended,
  tseslint.configs.recommended,
  importXPlugin.flatConfigs.recommended,
  importXPlugin.flatConfigs.typescript,
  jsxA11y.flatConfigs.recommended,
  react.configs.flat.recommended,
  react.configs.flat['jsx-runtime'],
  reactHooks.configs['recommended-latest'],
  reactCompiler.configs.recommended,
  {
    settings: {
      'import-x/resolver-next': [createTypeScriptImportResolver()],
      react: { version: 'detect' },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
);
