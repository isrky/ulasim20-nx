import {
  addProjectConfiguration,
  formatFiles,
  generateFiles,
  offsetFromRoot,
} from '@nx/devkit'
import type { Tree } from '@nx/devkit'
import { join } from 'node:path'

interface Schema {
  name: string
  type: 'util' | 'types' | 'data-access' | 'ui' | 'feature'
}

const IS_REACT_TYPE = (type: Schema['type']): boolean =>
  type === 'ui' || type === 'feature'

const HAS_TEST_TARGET = (type: Schema['type']): boolean => type === 'util'

export default async function (tree: Tree, schema: Schema) {
  const { name, type } = schema
  const dir = `libs/${type}/${name}`
  const projectName = `${type}-${name}`

  generateFiles(tree, join(__dirname, 'files'), dir, {
    name,
    type,
    scope: 'shared',
    isReact: IS_REACT_TYPE(type),
    hasTestTarget: HAS_TEST_TARGET(type),
    offsetFromRoot: offsetFromRoot(dir),
    tmpl: '',
  })

  // Register the project in the workspace graph so the new lib is visible to
  // `nx run-many` and the boundary/tag lint rules.
  addProjectConfiguration(tree, projectName, {
    name: projectName,
    root: dir,
    sourceRoot: `${dir}/src`,
    projectType: 'library',
    tags: [`type:${type}`, 'scope:shared'],
    targets: {
      build: { executor: 'nx:run-commands', options: { command: `tsc --build ${dir}` } },
      'type-check': { executor: 'nx:run-commands', options: { command: `tsc --build ${dir}` } },
      ...(HAS_TEST_TARGET(type)
        ? { test: { executor: 'nx:run-commands', options: { command: `vitest run --project=node ${dir}` } } }
        : {}),
      lint: {
        executor: 'nx:run-commands',
        options: {
          commands: [
            `biome lint ${dir}`,
            `eslint --config libs/config/eslint/eslint.config.mjs --no-warn-ignored '${dir}/**/*.{ts,tsx,js,jsx}'`,
          ],
          parallel: false,
        },
      },
    },
  })

  await formatFiles(tree)
}
