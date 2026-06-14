import nx from '@nx/eslint-plugin';

const boundaryRule = {
  files: ['*.ts', '*tsx', '*.js', '*.jsx'],
  rules: {
    '@nx/enforce-module-boundaries': [
      'error',
      {
        enforceBuildableLibDependency: true,
        allowCircularSelfDependency: false,
        banTransitiveDependencies: true,
        checkDynamicDependenciesExceptions: ['^node_modules/.*$'],
        allow: [],
        depConstraints: [
          { sourceTag: 'scope:web', onlyDependOnLibsWithTags: ['scope:web', 'scope:shared'] },
          { sourceTag: 'scope:backend', onlyDependOnLibsWithTags: ['scope:backend', 'scope:shared'] },
          { sourceTag: 'scope:mobile', onlyDependOnLibsWithTags: ['scope:mobile', 'scope:shared'] },
          { sourceTag: 'type:feature', onlyDependOnLibsWithTags: ['type:ui', 'type:data-access', 'type:util', 'type:types'] },
          { sourceTag: 'type:ui', onlyDependOnLibsWithTags: ['type:util', 'type:types'] },
          { sourceTag: 'type:data-access', onlyDependOnLibsWithTags: ['type:util', 'type:types'] },
          { sourceTag: 'type:util', onlyDependOnLibsWithTags: [] },
          { sourceTag: 'type:types', onlyDependOnLibsWithTags: [] }
        ]
      }
    ]
  }
};

export default [
  { ignores: ['**/dist/**', '**/node_modules/**', '**/.nx/**'] },
  boundaryRule
];
