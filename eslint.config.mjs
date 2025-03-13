import autoFix from 'eslint-plugin-autofix';
import globals from 'globals';
import importPlugin from 'eslint-plugin-import';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export default [
	importPlugin.flatConfigs.recommended,
	{ plugins: { autofix: autoFix } },
	{
		rules: {
			'autofix/no-plusplus': 'error',
			'autofix/no-unused-vars': 'error',
			'@typescript-eslint/no-unused-vars': 'off',
			'import/order': 'warn',
			'import/consistent-type-specifier-style': 'warn',
			'import/no-unresolved': 'off'
		}
	},
	{ files: ['**/*.{js,mjs,cjs,ts}'] },
	{ languageOptions: { globals: globals.node } },
	pluginJs.configs.recommended,
	...tseslint.configs.recommended
];
