import nx from '@nx/eslint-plugin';
import tseslint from 'typescript-eslint';

const boundaryRule = {
  files: ['**/*.ts', '**/*.tsx', '**/*.js', '**/*.jsx'],
  languageOptions: {
    parser: tseslint.parser
  },
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        allowCircularSelfDependency: false,
        banTransitiveDependencies: true,
        checkDynamicDependenciesExceptions: ['^node_modules/.*$', '^@ulasim20/.*$'],
        allow: [
          '^@/.*$',
          '^@radix-ui/.*$',
          '^@capacitor/.*$',
          '^react(-dom)?$',
          '^\\.\\./.*libs/config/.*$'
        ],
        depConstraints: [
          { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'] },
          { sourceTag: 'scope:backend', onlyDependOnLibsWithTags: ['scope:backend', 'scope:shared'] },
          { sourceTag: 'scope:mobile', onlyDependOnLibsWithTags: ['scope:mobile', 'scope:shared'] },
          { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:ui', 'type:data-access', 'type:util', 'type:types'] },
          { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:util', 'type:types'] },
          { sourceTag: 'type:data-access', onlyDependOnLibsWithTags: ['type:data-access', 'type:util', 'type:types'] },
          { sourceTag: 'type:util', onlyDependOnLibsWithTags: ['type:types'] },
          { sourceTag: 'type:types', onlyDependOnLibsWithTags: [] }
        ]
      }
    ],
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['@ulasim20/*/src/*', '@ulasim20/*/lib/*'],
            message: 'Import from the package root (e.g. @ulasim20/util-format), not from a deep path.'
          }
        ]
      }
    ]
  }
};

boundaryRule.plugins = { '@nx': nx };

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.nx/**', '**/*.d.ts', '**/*.test.{ts,tsx,js,jsx}', '**/*.spec.{ts,tsx,js,jsx}'] },
  boundaryRule
];
