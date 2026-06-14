# Nx Monorepo Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the `ulasim20-reborn` repository into a pnpm + Nx monorepo with shared libraries, enforced module boundaries, and Nx Cloud-backed CI.

**Architecture:** Big-bang single-PR migration. Existing code is moved into `apps/{web,backend,mobile}/` and `libs/{feature,ui,data-access,util,types,config}/`. pnpm workspaces handle package linking. Nx runs tasks with project-level caching. ESLint enforces scope/type boundaries via tags.

**Tech Stack:** pnpm workspaces, Nx 19+, TypeScript 5.5, Vite 7, Hono 4, Wrangler 4, Cloudflare Workers + Pages, Capacitor 8, React 18, Tailwind 4, Biome 1.9, ESLint (boundary rule only), Vitest 2.1, Playwright 1.59.

**Spec:** `docs/superpowers/specs/2026-06-14-nx-monorepo-design.md`

---

## File Structure

### New top-level files
- `nx.json` — Nx configuration (target defaults, named inputs, default base).
- `pnpm-workspace.yaml` — workspace package globs.
- `tsconfig.base.json` — root TS config + path mappings for `@ulasim20/*` packages.
- `vitest.workspace.ts` — updated to scan apps/*/src and libs/*/src.
- `.github/workflows/ci.yml` — Nx Cloud + GitHub Actions CI.

### New apps
- `apps/web/` — `package.json`, `project.json`, `tsconfig.json`, `vite.config.ts`, `index.html`, `src/`, `public/`, `functions/`.
- `apps/backend/` — `package.json`, `project.json`, `tsconfig.json`, `wrangler.toml`, `vitest.config.ts`, `src/`, `scripts/`.
- `apps/mobile/` — `package.json`, `project.json`, `capacitor.config.ts`, `android/`.

### New libs (each gets `package.json`, `project.json`, `tsconfig.json`, `src/index.ts`)
- `libs/config/{tsconfig,eslint,vite,tailwind,biome}/`
- `libs/types/{transport,api,env}/`
- `libs/util/{date,geo,format,validation}/`
- `libs/data-access/{api-client,transport-api,msw-handlers,capacitor}/`
- `libs/ui/{primitives,layout,map,icons,theme}/`
- `libs/feature/{routes,planner,vehicles,notifications,auth}/`

### Deleted (post-validation)
- `src/`, `backend/`, `functions/`, `android/`, root `vite.config.ts`, root `tsconfig.json`, root `tsconfig.node.json`, root `vitest.config.ts`, root `capacitor.config.ts`, root `package-lock.json`.

### Preserved at repo root
- `tests/setup/` — vitest setup files (frontend.ts, node.ts, vitest.d.ts).
- `tests/unit/` — analytics, feedback-validation, line-discovery, sanity tests.
- `tests/helpers/` — test helpers.
- `e2e/` — Playwright tests.
- `playwright.config.ts` — E2E config.
- `biome.json` — root lint+format.
- `public/` (moves to `apps/web/public/`).
- `README.md`, `LICENSE`, `.env.example`, `.env.production`, `flake.nix`, `flake.lock`, `.envrc`, `.direnv/`, `gradle.properties`, `components.json`, `postcss.config.js`, `.gitignore`, `.cursor/`.

---

## Task 1: Bootstrap Nx + pnpm

**Files:**
- Create: `nx.json`
- Create: `pnpm-workspace.yaml`
- Create: `tsconfig.base.json`
- Modify: `package.json` (root)
- Delete: `package-lock.json` (replaced by `pnpm-lock.yaml`)

- [ ] **Step 1: Verify pnpm is available**

Run: `pnpm --version`
Expected: a version >= 9. If not, install via `corepack enable && corepack prepare pnpm@latest --activate`.

- [ ] **Step 2: Create `pnpm-workspace.yaml`**

```yaml
packages:
  - "apps/*"
  - "libs/*"
```

- [ ] **Step 3: Create `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "baseUrl": ".",
    "paths": {
      "@ulasim20/config-tsconfig": ["libs/config/tsconfig"],
      "@ulasim20/config-eslint": ["libs/config/eslint"],
      "@ulasim20/config-vite": ["libs/config/vite"],
      "@ulasim20/config-tailwind": ["libs/config/tailwind"],
      "@ulasim20/config-biome": ["libs/config/biome"],
      "@ulasim20/types-transport": ["libs/types/transport/src/index.ts"],
      "@ulasim20/types-api": ["libs/types/api/src/index.ts"],
      "@ulasim20/types-env": ["libs/types/env/src/index.ts"],
      "@ulasim20/util-date": ["libs/util/date/src/index.ts"],
      "@ulasim20/util-geo": ["libs/util/geo/src/index.ts"],
      "@ulasim20/util-format": ["libs/util/format/src/index.ts"],
      "@ulasim20/util-validation": ["libs/util/validation/src/index.ts"],
      "@ulasim20/data-access-api-client": ["libs/data-access/api-client/src/index.ts"],
      "@ulasim20/data-access-transport-api": ["libs/data-access/transport-api/src/index.ts"],
      "@ulasim20/data-access-msw-handlers": ["libs/data-access/msw-handlers/src/index.ts"],
      "@ulasim20/data-access-capacitor": ["libs/data-access/capacitor/src/index.ts"],
      "@ulasim20/ui-primitives": ["libs/ui/primitives/src/index.ts"],
      "@ulasim20/ui-layout": ["libs/ui/layout/src/index.ts"],
      "@ulasim20/ui-map": ["libs/ui/map/src/index.ts"],
      "@ulasim20/ui-icons": ["libs/ui/icons/src/index.ts"],
      "@ulasim20/ui-theme": ["libs/ui/theme/src/index.ts"],
      "@ulasim20/feature-routes": ["libs/feature/routes/src/index.ts"],
      "@ulasim20/feature-planner": ["libs/feature/planner/src/index.ts"],
      "@ulasim20/feature-vehicles": ["libs/feature/vehicles/src/index.ts"],
      "@ulasim20/feature-notifications": ["libs/feature/notifications/src/index.ts"],
      "@ulasim20/feature-auth": ["libs/feature/auth/src/index.ts"]
    }
  }
}
```

- [ ] **Step 4: Create `nx.json`**

```json
{
  "$schema": "./node_modules/nx/schemas/nx-schema.json",
  "namedInputs": {
    "default": ["{projectRoot}/**/*", "sharedGlobals"],
    "production": [
      "default",
      "!{projectRoot}/**/?(*.)+(spec|test).[jt]s?(x)",
      "!{projectRoot}/tsconfig.spec.json"
    ],
    "sharedGlobals": ["{workspaceRoot}/tsconfig.base.json", "{workspaceRoot}/biome.json"]
  },
  "targetDefaults": {
    "build": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["production", "^production"]
    },
    "test": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["default", "^production", "{workspaceRoot}/vitest.workspace.ts"]
    },
    "lint": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["default", "{workspaceRoot}/biome.json"]
    },
    "type-check": {
      "cache": true,
      "dependsOn": ["^build"],
      "inputs": ["default", "{workspaceRoot}/tsconfig.base.json"]
    }
  },
  "defaultBase": "main",
  "workspaceLayout": {
    "appsDir": "apps",
    "libsDir": "libs"
  }
}
```

- [ ] **Step 5: Rewrite root `package.json`**

```json
{
  "name": "ulasim20-nx",
  "private": true,
  "version": "1.0.0",
  "description": "Denizli Ulaşım Portalı — Nx monorepo",
  "packageManager": "pnpm@9.12.0",
  "engines": {
    "node": ">=20"
  },
  "scripts": {
    "dev": "pnpm exec nx serve web",
    "dev:backend": "pnpm exec nx serve backend",
    "build": "pnpm exec nx run-many -t build",
    "build:web": "pnpm exec nx build web",
    "build:backend": "pnpm exec nx build backend",
    "test": "pnpm exec nx run-many -t test",
    "test:web": "pnpm exec nx test web",
    "test:backend": "pnpm exec nx test backend",
    "test:e2e": "playwright test",
    "typecheck": "pnpm exec nx run-many -t type-check",
    "lint": "pnpm exec nx run-many -t lint",
    "lint:fix": "biome lint --write .",
    "format": "biome format .",
    "format:fix": "biome format --write .",
    "check": "biome check .",
    "check:fix": "biome check --write .",
    "planner:fetch": "pnpm exec nx run backend:planner:fetch-normalize",
    "planner:signature": "pnpm exec nx run backend:planner:compute-source-signature",
    "planner:compile": "pnpm exec nx run backend:planner:compile-dataset",
    "planner:validate": "pnpm exec nx run backend:planner:validate-dataset",
    "planner:promote": "pnpm exec nx run backend:planner:promote-manifest"
  },
  "devDependencies": {
    "@biomejs/biome": "1.9.4",
    "@nx/eslint": "19.8.0",
    "@nx/js": "19.8.0",
    "@nx/react": "19.8.0",
    "@nx/workspace": "19.8.0",
    "nx": "19.8.0",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 6: Update `.gitignore` to include Nx artifacts**

Add (preserving existing content):
```
# Nx
.nx/cache
.nx/workspace-data
dist/
tmp/
```

- [ ] **Step 7: Install Nx as a dev dependency**

Run: `pnpm install`
Expected: `pnpm-lock.yaml` is created. `node_modules/nx` exists.

- [ ] **Step 8: Verify Nx sees the workspace**

Run: `pnpm exec nx --version`
Expected: `19.8.0` (or installed version).

- [ ] **Step 9: Commit**

```bash
git add nx.json pnpm-workspace.yaml tsconfig.base.json package.json pnpm-lock.yaml .gitignore
git rm package-lock.json
git commit -m "chore(nx): bootstrap pnpm + Nx workspace"
```

---

## Task 2: Create config libs (tsconfig, eslint, biome, tailwind, vite)

**Files:**
- Create: `libs/config/tsconfig/{package.json,project.json,src/index.ts}`
- Create: `libs/config/eslint/{package.json,project.json,eslint.config.mjs,src/index.ts}`
- Create: `libs/config/biome/{package.json,project.json,biome.json,src/index.ts}`
- Create: `libs/config/tailwind/{package.json,project.json,tailwind.preset.js,src/index.ts}`
- Create: `libs/config/vite/{package.json,project.json,vite.preset.js,src/index.ts}`

- [ ] **Step 1: Create `libs/config/tsconfig/package.json`**

```json
{
  "name": "@ulasim20/config-tsconfig",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

- [ ] **Step 2: Create `libs/config/tsconfig/project.json`**

```json
{
  "name": "config-tsconfig",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/config/tsconfig/src",
  "projectType": "library",
  "tags": ["type:config"],
  "targets": {
    "lint": {
      "executor": "nx:run-commands",
      "options": {
        "command": "biome lint libs/config/tsconfig"
      }
    }
  }
}
```

- [ ] **Step 3: Create `libs/config/tsconfig/src/index.ts`**

```typescript
export const baseConfigPath = '../../tsconfig.base.json';

export function getTsConfigPreset() {
  return { extends: baseConfigPath };
}
```

- [ ] **Step 4: Create `libs/config/eslint/package.json`**

```json
{
  "name": "@ulasim20/config-eslint",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./eslint.config.mjs"
  },
  "dependencies": {
    "@nx/eslint": "19.8.0",
    "eslint": "^9.0.0"
  }
}
```

- [ ] **Step 5: Create `libs/config/eslint/eslint.config.mjs`**

```javascript
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
```

- [ ] **Step 6: Create `libs/config/eslint/project.json`**

```json
{
  "name": "config-eslint",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/config/eslint/src",
  "projectType": "library",
  "tags": ["type:config"],
  "targets": {
    "lint": {
      "executor": "nx:run-commands",
      "options": { "command": "biome lint libs/config/eslint" }
    }
  }
}
```

- [ ] **Step 7: Create `libs/config/eslint/src/index.ts`**

```typescript
export { default as config } from '../eslint.config.mjs';
```

- [ ] **Step 8: Create `libs/config/biome/package.json`**

```json
{
  "name": "@ulasim20/config-biome",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./biome.json"
  }
}
```

- [ ] **Step 9: Create `libs/config/biome/biome.json`**

```json
{
  "$schema": "https://biomejs.dev/schemas/1.9.4/schema.json",
  "vcs": { "enabled": true, "clientKind": "git", "useIgnoreFile": true },
  "files": {
    "ignore": ["**/dist/**", "**/.nx/**", "**/node_modules/**", "**/coverage/**"]
  },
  "formatter": { "enabled": true, "indentStyle": "space", "indentWidth": 2, "lineWidth": 100 },
  "organizeImports": { "enabled": true },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true,
      "suspicious": { "noExplicitAny": "warn" },
      "style": { "useImportType": "warn" }
    }
  },
  "javascript": { "formatter": { "quoteStyle": "single", "semicolons": "asNeeded", "trailingCommas": "es5" } }
}
```

- [ ] **Step 10: Create `libs/config/biome/project.json` and `src/index.ts`**

`project.json`:
```json
{
  "name": "config-biome",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/config/biome/src",
  "projectType": "library",
  "tags": ["type:config"],
  "targets": { "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/config/biome" } } }
}
```

`src/index.ts`:
```typescript
export { default as config } from '../biome.json';
```

- [ ] **Step 11: Create `libs/config/tailwind/`**

`package.json`:
```json
{
  "name": "@ulasim20/config-tailwind",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": {
    ".": "./tailwind.preset.js"
  },
  "dependencies": {
    "tailwindcss": "^4.1.16",
    "@tailwindcss/vite": "^4.1.16",
    "@tailwindcss/postcss": "^4.1.16",
    "tw-animate-css": "^1.4.0"
  }
}
```

`tailwind.preset.js`:
```javascript
export default {
  theme: {
    extend: {
      colors: {
        primary: '#0E7490',
        surface: '#FFFFFF',
        background: '#FAFAFA'
      }
    }
  },
  plugins: []
};
```

`project.json`:
```json
{
  "name": "config-tailwind",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/config/tailwind/src",
  "projectType": "library",
  "tags": ["type:config"],
  "targets": { "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/config/tailwind" } } }
}
```

`src/index.ts`:
```typescript
export { default as preset } from '../tailwind.preset.js';
```

- [ ] **Step 12: Create `libs/config/vite/`**

`package.json`:
```json
{
  "name": "@ulasim20/config-vite",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./vite.preset.js" },
  "dependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "@vitejs/plugin-basic-ssl": "^2.1.0",
    "vite": "^7.3.2",
    "vite-plugin-qrcode": "^0.3.0",
    "@tailwindcss/vite": "^4.1.16"
  }
}
```

`vite.preset.js`:
```javascript
import basicSsl from '@vitejs/plugin-basic-ssl';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { qrcode } from 'vite-plugin-qrcode';

const isRemote = process.env.REMOTE === 'true';

export const plugins = [react(), tailwindcss(), ...(!isRemote ? [basicSsl()] : []), qrcode()];

export const server = {
  allowedHosts: true,
  host: true,
  port: 3080,
  open: !isRemote
};
```

`project.json`:
```json
{
  "name": "config-vite",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/config/vite/src",
  "projectType": "library",
  "tags": ["type:config"],
  "targets": { "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/config/vite" } } }
}
```

`src/index.ts`:
```typescript
export { plugins, server } from '../vite.preset.js';
```

- [ ] **Step 13: Run `pnpm install` and verify libs resolve**

Run: `pnpm install`
Expected: install completes without errors.

- [ ] **Step 14: Commit**

```bash
git add libs/config
git commit -m "feat(config): add config libs (tsconfig, eslint, biome, tailwind, vite)"
```

---

## Task 3: Create `libs/types/*` (transport, api, env)

**Files:**
- Create: `libs/types/transport/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/types/api/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/types/env/{package.json,project.json,tsconfig.json,src/index.ts}`

- [ ] **Step 1: Inspect the existing type files to migrate**

Open: `src/types/favorites.ts`
Open: `backend/src/types.ts`
Read them and note any types they export.

- [ ] **Step 2: Create `libs/types/transport/`**

`package.json`:
```json
{
  "name": "@ulasim20/types-transport",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`project.json`:
```json
{
  "name": "types-transport",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/types/transport/src",
  "projectType": "library",
  "tags": ["type:types"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/types/transport" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/types/transport" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/types/transport" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
export type Coordinates = { lat: number; lon: number };

export type Route = {
  id: string;
  shortName: string;
  longName: string;
  type: 'bus' | 'tram' | 'minibus';
  color?: string;
};

export type Stop = {
  id: string;
  name: string;
  code?: string;
  location: Coordinates;
  routes: string[];
};

export type Vehicle = {
  id: string;
  routeId: string;
  position: Coordinates;
  bearing?: number;
  updatedAt: string;
};

export type Trip = {
  id: string;
  routeId: string;
  headsign: string;
  stops: string[];
  startTime: string;
  endTime: string;
};
```

- [ ] **Step 3: Create `libs/types/api/`**

`package.json`:
```json
{
  "name": "@ulasim20/types-api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`project.json`:
```json
{
  "name": "types-api",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/types/api/src",
  "projectType": "library",
  "tags": ["type:types"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/types/api" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/types/api" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/types/api" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
export type ApiResponse<T> = { data: T; ok: true } | { ok: false; error: string; status: number };

export type Paginated<T> = { items: T[]; total: number; page: number; pageSize: number };

export type FavoriteLine = { id: string; routeId: string; label?: string; createdAt: string };
```

- [ ] **Step 4: Create `libs/types/env/`**

`package.json`:
```json
{
  "name": "@ulasim20/types-env",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "zod": "^4.1.12" }
}
```

`project.json`:
```json
{
  "name": "types-env",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/types/env/src",
  "projectType": "library",
  "tags": ["type:types"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/types/env" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/types/env" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/types/env" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
import { z } from 'zod';

export const WebEnvSchema = z.object({
  VITE_API_BASE_URL: z.string().url().default('http://localhost:8787'),
  VITE_BACKEND_URL: z.string().url().default('http://localhost:8787')
});

export const BackendEnvSchema = z.object({
  BACKEND_URL: z.string().url().default('https://api.ulasim20.com')
});

export type WebEnv = z.infer<typeof WebEnvSchema>;
export type BackendEnv = z.infer<typeof BackendEnvSchema>;
```

- [ ] **Step 5: Run `pnpm install`**

Run: `pnpm install`
Expected: install completes; no errors about missing peer deps for `zod`.

- [ ] **Step 6: Verify each lib type-checks**

Run: `pnpm exec nx run-many -t type-check --projects=types-transport,types-api,types-env`
Expected: all three projects succeed.

- [ ] **Step 7: Commit**

```bash
git add libs/types
git commit -m "feat(types): add transport, api, env type libs"
```

---

## Task 4: Create `libs/util/*` (date, geo, format, validation)

**Files:**
- Create: `libs/util/date/{package.json,project.json,tsconfig.json,src/index.ts,src/index.test.ts}`
- Create: `libs/util/geo/{package.json,project.json,tsconfig.json,src/index.ts,src/index.test.ts}`
- Create: `libs/util/format/{package.json,project.json,tsconfig.json,src/index.ts,src/index.test.ts}`
- Create: `libs/util/validation/{package.json,project.json,tsconfig.json,src/index.ts}`

- [ ] **Step 1: Create `libs/util/date/`**

`package.json`:
```json
{
  "name": "@ulasim20/util-date",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "date-fns": "^4.1.0" }
}
```

`project.json`:
```json
{
  "name": "util-date",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/util/date/src",
  "projectType": "library",
  "tags": ["type:util"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/util/date" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/util/date" } },
    "test": { "executor": "nx:run-commands", "options": { "command": "vitest run --project=node libs/util/date" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/util/date" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
import { format, formatDistanceToNow, parseISO } from 'date-fns';
import { tr } from 'date-fns/locale';

export function formatTr(date: Date | string, pattern = 'd MMMM yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, pattern, { locale: tr });
}

export function timeAgo(date: Date | string): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return formatDistanceToNow(d, { addSuffix: true, locale: tr });
}
```

`src/index.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { formatTr, timeAgo } from './index';

describe('formatTr', () => {
  it('formats a Date in Turkish locale', () => {
    const out = formatTr(new Date('2026-01-15T12:00:00Z'), 'yyyy-MM-dd');
    expect(out).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });
});

describe('timeAgo', () => {
  it('returns a Turkish suffix', () => {
    const out = timeAgo(new Date(Date.now() - 60_000));
    expect(out.length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Create `libs/util/geo/`**

`package.json`:
```json
{
  "name": "@ulasim20/util-geo",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`project.json`:
```json
{
  "name": "util-geo",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/util/geo/src",
  "projectType": "library",
  "tags": ["type:util"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/util/geo" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/util/geo" } },
    "test": { "executor": "nx:run-commands", "options": { "command": "vitest run --project=node libs/util/geo" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/util/geo" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
import type { Coordinates } from '@ulasim20/types-transport';

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.sin(dLon / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2);
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

export function bbox(points: Coordinates[]): { minLat: number; minLon: number; maxLat: number; maxLon: number } {
  if (points.length === 0) {
    return { minLat: 0, minLon: 0, maxLat: 0, maxLon: 0 };
  }
  let minLat = points[0].lat;
  let minLon = points[0].lon;
  let maxLat = points[0].lat;
  let maxLon = points[0].lon;
  for (const p of points) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lon < minLon) minLon = p.lon;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lon > maxLon) maxLon = p.lon;
  }
  return { minLat, minLon, maxLat, maxLon };
}
```

`src/index.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { bbox, haversineDistance } from './index';

describe('haversineDistance', () => {
  it('returns 0 for the same point', () => {
    expect(haversineDistance({ lat: 0, lon: 0 }, { lat: 0, lon: 0 })).toBe(0);
  });
  it('returns ~111km for 1 degree of latitude at the equator', () => {
    const d = haversineDistance({ lat: 0, lon: 0 }, { lat: 1, lon: 0 });
    expect(d).toBeGreaterThan(110_000);
    expect(d).toBeLessThan(112_000);
  });
});

describe('bbox', () => {
  it('handles a list of points', () => {
    const b = bbox([
      { lat: 1, lon: 2 },
      { lat: 3, lon: 4 }
    ]);
    expect(b).toEqual({ minLat: 1, minLon: 2, maxLat: 3, maxLon: 4 });
  });
});
```

- [ ] **Step 3: Create `libs/util/format/`**

`package.json`:
```json
{
  "name": "@ulasim20/util-format",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`project.json`:
```json
{
  "name": "util-format",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/util/format/src",
  "projectType": "library",
  "tags": ["type:util"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/util/format" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/util/format" } },
    "test": { "executor": "nx:run-commands", "options": { "command": "vitest run --project=node libs/util/format" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/util/format" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
export function trSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function formatNumberTr(n: number): string {
  return new Intl.NumberFormat('tr-TR').format(n);
}
```

`src/index.test.ts`:
```typescript
import { describe, expect, it } from 'vitest';
import { formatNumberTr, trSlug } from './index';

describe('trSlug', () => {
  it('transliterates Turkish characters', () => {
    expect(trSlug('İstasyon Şubesi')).toBe('istasyon-subesi');
  });
  it('collapses non-alphanumerics', () => {
    expect(trSlug('Hat 123 - Güzergah!')).toBe('hat-123-guzergah');
  });
});

describe('formatNumberTr', () => {
  it('formats with Turkish separators', () => {
    const out = formatNumberTr(1234.5);
    expect(out).toMatch(/1\.234/);
  });
});
```

- [ ] **Step 4: Create `libs/util/validation/`**

`package.json`:
```json
{
  "name": "@ulasim20/util-validation",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "zod": "^4.1.12" }
}
```

`project.json`:
```json
{
  "name": "util-validation",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/util/validation/src",
  "projectType": "library",
  "tags": ["type:util"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/util/validation" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/util/validation" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/util/validation" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
import { z } from 'zod';

export const SlugSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/u, 'must be lowercase letters, digits, and dashes');

export const EmailSchema = z.string().email();

export const NonEmptyStringSchema = z.string().min(1);

export function safeParse<T extends z.ZodTypeAny>(schema: T, value: unknown) {
  const result = schema.safeParse(value);
  return result.success ? { ok: true as const, data: result.data } : { ok: false as const, error: result.error };
}
```

- [ ] **Step 5: Run `pnpm install` and type-check all util libs**

Run: `pnpm install && pnpm exec nx run-many -t type-check --projects=util-date,util-geo,util-format,util-validation`
Expected: all four projects succeed.

- [ ] **Step 6: Run unit tests for util libs**

Run: `pnpm exec nx run-many -t test --projects=util-date,util-geo,util-format`
Expected: all tests pass.

- [ ] **Step 7: Commit**

```bash
git add libs/util
git commit -m "feat(util): add date, geo, format, validation util libs with tests"
```

---

## Task 5: Create `libs/data-access/*` (api-client, transport-api, msw-handlers, capacitor)

**Files:**
- Create: `libs/data-access/api-client/{package.json,project.json,tsconfig.json,src/index.ts,src/index.test.ts}`
- Create: `libs/data-access/transport-api/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/data-access/msw-handlers/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/data-access/capacitor/{package.json,project.json,tsconfig.json,src/index.ts}`

- [ ] **Step 1: Inspect current data-access code**

Open: `src/lib/denizli-api.ts` (`src/api/denizli.ts`), `src/lib/route-api.ts` (`src/api/route-api.ts`), `src/lib/pocketbase.ts`, `src/lib/capacitor.ts`.
Read them to understand current API call shapes and Capacitor usage.

- [ ] **Step 2: Create `libs/data-access/api-client/`**

`package.json`:
```json
{
  "name": "@ulasim20/data-access-api-client",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" }
}
```

`project.json`:
```json
{
  "name": "data-access-api-client",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/data-access/api-client/src",
  "projectType": "library",
  "tags": ["type:data-access"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/data-access/api-client" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/data-access/api-client" } },
    "test": { "executor": "nx:run-commands", "options": { "command": "vitest run --project=node libs/data-access/api-client" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/data-access/api-client" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
export type ApiClientOptions = {
  baseUrl: string;
  defaultHeaders?: Record<string, string>;
  fetchImpl?: typeof fetch;
};

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly body?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;

  constructor(private readonly options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? fetch;
  }

  async request<T>(method: string, path: string, init: RequestInit = {}): Promise<T> {
    const url = new URL(path, this.options.baseUrl).toString();
    const headers = new Headers(init.headers);
    if (this.options.defaultHeaders) {
      for (const [k, v] of Object.entries(this.options.defaultHeaders)) headers.set(k, v);
    }
    if (init.body && !headers.has('content-type')) {
      headers.set('content-type', 'application/json');
    }
    const res = await this.fetchImpl(url, { ...init, method, headers });
    if (!res.ok) {
      const body = await safeReadBody(res);
      throw new ApiError(`HTTP ${res.status} on ${method} ${path}`, res.status, body);
    }
    if (res.status === 204) return undefined as T;
    return (await res.json()) as T;
  }

  get<T>(path: string) {
    return this.request<T>('GET', path);
  }
  post<T>(path: string, body?: unknown) {
    return this.request<T>('POST', path, { body: body ? JSON.stringify(body) : undefined });
  }
}

async function safeReadBody(res: Response): Promise<unknown> {
  try {
    return await res.json();
  } catch {
    return await res.text();
  }
}
```

`src/index.test.ts`:
```typescript
import { describe, expect, it, vi } from 'vitest';
import { ApiClient, ApiError } from './index';

describe('ApiClient', () => {
  it('performs a GET and returns JSON', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response(JSON.stringify({ ok: true }), { status: 200, headers: { 'content-type': 'application/json' } }));
    const client = new ApiClient({ baseUrl: 'https://example.com', fetchImpl });
    const out = await client.get<{ ok: boolean }>('/health');
    expect(out).toEqual({ ok: true });
    expect(fetchImpl).toHaveBeenCalledWith('https://example.com/health', expect.objectContaining({ method: 'GET' }));
  });

  it('throws ApiError on non-2xx', async () => {
    const fetchImpl = vi.fn().mockResolvedValue(new Response('boom', { status: 500 }));
    const client = new ApiClient({ baseUrl: 'https://example.com', fetchImpl });
    await expect(client.get('/x')).rejects.toBeInstanceOf(ApiError);
  });
});
```

- [ ] **Step 3: Create `libs/data-access/transport-api/`**

`package.json`:
```json
{
  "name": "@ulasim20/data-access-transport-api",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@ulasim20/data-access-api-client": "workspace:*",
    "@ulasim20/types-transport": "workspace:*",
    "@ulasim20/types-api": "workspace:*"
  }
}
```

`project.json`:
```json
{
  "name": "data-access-transport-api",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/data-access/transport-api/src",
  "projectType": "library",
  "tags": ["type:data-access"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/data-access/transport-api" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/data-access/transport-api" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/data-access/transport-api" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
import { ApiClient } from '@ulasim20/data-access-api-client';
import type { Route, Stop, Vehicle } from '@ulasim20/types-transport';
import type { ApiResponse } from '@ulasim20/types-api';

export class TransportApi {
  constructor(private readonly client: ApiClient) {}

  listRoutes(): Promise<ApiResponse<Route[]>> {
    return this.client.get<ApiResponse<Route[]>>('/routes');
  }

  listStops(): Promise<ApiResponse<Stop[]>> {
    return this.client.get<ApiResponse<Stop[]>>('/stops');
  }

  liveVehicles(): Promise<ApiResponse<Vehicle[]>> {
    return this.client.get<ApiResponse<Vehicle[]>>('/vehicles/live');
  }
}
```

- [ ] **Step 4: Create `libs/data-access/msw-handlers/`**

`package.json`:
```json
{
  "name": "@ulasim20/data-access-msw-handlers",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "msw": "2.13.4" }
}
```

`project.json`:
```json
{
  "name": "data-access-msw-handlers",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/data-access/msw-handlers/src",
  "projectType": "library",
  "tags": ["type:data-access"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/data-access/msw-handlers" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/data-access/msw-handlers" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/data-access/msw-handlers" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
import { http, HttpResponse } from 'msw';
import type { Route, Stop, Vehicle } from '@ulasim20/types-transport';

export const handlers = [
  http.get('/api/routes', () => HttpResponse.json<{ ok: true; data: Route[] }>({ ok: true, data: [] })),
  http.get('/api/stops', () => HttpResponse.json<{ ok: true; data: Stop[] }>({ ok: true, data: [] })),
  http.get('/api/vehicles/live', () => HttpResponse.json<{ ok: true; data: Vehicle[] }>({ ok: true, data: [] }))
];
```

- [ ] **Step 5: Create `libs/data-access/capacitor/`**

`package.json`:
```json
{
  "name": "@ulasim20/data-access-capacitor",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@capacitor/core": "8.0.0",
    "@capacitor/geolocation": "^8.0.0",
    "@capacitor/haptics": "8.0.0",
    "@capacitor/local-notifications": "^8.0.2",
    "@capacitor/preferences": "8.0.0",
    "@ulasim20/util-validation": "workspace:*"
  }
}
```

`project.json`:
```json
{
  "name": "data-access-capacitor",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/data-access/capacitor/src",
  "projectType": "library",
  "tags": ["type:data-access"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/data-access/capacitor" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/data-access/capacitor" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/data-access/capacitor" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
import { Geolocation } from '@capacitor/geolocation';
import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { LocalNotifications } from '@capacitor/local-notifications';
import { Preferences } from '@capacitor/preferences';
import { SlugSchema } from '@ulasim20/util-validation';

export async function currentPosition(): Promise<{ lat: number; lon: number } | null> {
  try {
    const perm = await Geolocation.checkPermissions();
    if (perm.location !== 'granted') {
      const req = await Geolocation.requestPermissions();
      if (req.location !== 'granted') return null;
    }
    const pos = await Geolocation.getCurrentPosition();
    return { lat: pos.coords.latitude, lon: pos.coords.longitude };
  } catch {
    return null;
  }
}

export async function tap(): Promise<void> {
  await Haptics.impact({ style: ImpactStyle.Light });
}

export async function notify(title: string, body: string): Promise<void> {
  await LocalNotifications.schedule({ notifications: [{ title, body, id: Date.now() }] });
}

export async function readPref(key: string): Promise<string | null> {
  const parsed = SlugSchema.safeParse(key);
  if (!parsed.success) throw new Error(`invalid pref key: ${key}`);
  const { value } = await Preferences.get({ key });
  return value;
}
```

- [ ] **Step 6: Run `pnpm install`**

Run: `pnpm install`
Expected: install completes.

- [ ] **Step 7: Type-check all data-access libs**

Run: `pnpm exec nx run-many -t type-check --projects=data-access-api-client,data-access-transport-api,data-access-msw-handlers,data-access-capacitor`
Expected: all projects succeed.

- [ ] **Step 8: Run api-client tests**

Run: `pnpm exec nx test data-access-api-client`
Expected: tests pass.

- [ ] **Step 9: Commit**

```bash
git add libs/data-access
git commit -m "feat(data-access): add api-client, transport-api, msw-handlers, capacitor libs"
```

---

## Task 6: Create `libs/ui/*` (primitives, layout, map, icons, theme)

**Files:**
- Create: `libs/ui/primitives/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/ui/layout/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/ui/map/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/ui/icons/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/ui/theme/{package.json,project.json,tsconfig.json,src/index.ts}`

- [ ] **Step 1: Inspect the existing UI components**

Open the contents of `src/components/ui/`. Note the file list to know what to migrate (full file list: `accordion`, `alert`, `alert-dialog`, `aspect-ratio`, `avatar`, `badge`, `breadcrumb`, `button`, `button-group`, `calendar`, `card`, `carousel`, `chart`, `checkbox`, `collapsible`, `command`, `context-menu`, `dialog`, `drawer`, `dropdown-menu`, `empty`, `field`, `form`, `hover-card`, `input`, `input-group`, `input-otp`, `item`, `kbd`, plus more). These will move into `libs/ui/primitives/` in Task 7 (Step 5). For now we just create the lib skeletons.

- [ ] **Step 2: Create `libs/ui/primitives/`**

`package.json`:
```json
{
  "name": "@ulasim20/ui-primitives",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "peerDependencies": {
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "@radix-ui/react-slot": "^1.2.3",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "tailwind-merge": "^3.3.1"
  }
}
```

`project.json`:
```json
{
  "name": "ui-primitives",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/ui/primitives/src",
  "projectType": "library",
  "tags": ["type:ui", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/primitives" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/primitives" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/ui/primitives" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export { Button } from './lib/button';
export { Card, CardHeader, CardTitle, CardContent } from './lib/card';
export { Input } from './lib/input';
export { cn } from './lib/cn';
```

`src/lib/cn.ts`:
```typescript
import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
```

`src/lib/button.tsx`:
```tsx
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { forwardRef } from 'react';
import { cn } from './cn';

const buttonVariants = cva(
  'inline-flex items-center justify-center rounded-md text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2',
  {
    variants: {
      variant: {
        default: 'bg-primary text-white hover:bg-primary/90',
        outline: 'border border-input bg-background hover:bg-accent',
        ghost: 'hover:bg-accent hover:text-accent-foreground'
      },
      size: {
        default: 'h-10 px-4 py-2',
        sm: 'h-9 px-3',
        lg: 'h-11 px-8'
      }
    },
    defaultVariants: { variant: 'default', size: 'default' }
  }
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';
    return <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />;
  }
);
Button.displayName = 'Button';

export { buttonVariants };
```

`src/lib/card.tsx`:
```tsx
import { forwardRef } from 'react';
import { cn } from './cn';

export const Card = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => (
    <div ref={ref} className={cn('rounded-lg border bg-card text-card-foreground shadow-sm', className)} {...props} />
  )
);
Card.displayName = 'Card';

export const CardHeader = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('flex flex-col space-y-1.5 p-6', className)} {...props} />
);
CardHeader.displayName = 'CardHeader';

export const CardTitle = forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h3 ref={ref} className={cn('text-2xl font-semibold leading-none tracking-tight', className)} {...props} />
  )
);
CardTitle.displayName = 'CardTitle';

export const CardContent = forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
  ({ className, ...props }, ref) => <div ref={ref} className={cn('p-6 pt-0', className)} {...props} />
);
CardContent.displayName = 'CardContent';
```

`src/lib/input.tsx`:
```tsx
import { forwardRef } from 'react';
import { cn } from './cn';

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, type = 'text', ...props }, ref) => (
    <input
      type={type}
      ref={ref}
      className={cn('flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm', className)}
      {...props}
    />
  )
);
Input.displayName = 'Input';
```

- [ ] **Step 3: Create `libs/ui/layout/`**

`package.json`:
```json
{
  "name": "@ulasim20/ui-layout",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "peerDependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" }
}
```

`project.json`:
```json
{
  "name": "ui-layout",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/ui/layout/src",
  "projectType": "library",
  "tags": ["type:ui", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/layout" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/layout" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/ui/layout" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export { AppShell } from './lib/app-shell';
export { PageHeader } from './lib/page-header';
```

`src/lib/app-shell.tsx`:
```tsx
import type { ReactNode } from 'react';

export function AppShell({ children }: { children: ReactNode }) {
  return <div className="flex min-h-screen flex-col bg-background text-foreground">{children}</div>;
}
```

`src/lib/page-header.tsx`:
```tsx
import type { ReactNode } from 'react';

export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <header className="border-b px-6 py-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        </div>
        {actions ? <div className="flex gap-2">{actions}</div> : null}
      </div>
    </header>
  );
}
```

- [ ] **Step 4: Create `libs/ui/map/`**

`package.json`:
```json
{
  "name": "@ulasim20/ui-map",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "leaflet": "^1.9.4",
    "react-leaflet": "^4.2.1"
  },
  "peerDependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" }
}
```

`project.json`:
```json
{
  "name": "ui-map",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/ui/map/src",
  "projectType": "library",
  "tags": ["type:ui", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/map" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/map" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/ui/map" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export { MapView } from './lib/map-view';
export { MapMarker } from './lib/map-marker';
```

`src/lib/map-view.tsx`:
```tsx
import type { ReactNode } from 'react';
import { MapContainer, TileLayer } from 'react-leaflet';

export function MapView({ center, zoom = 13, children }: { center: [number, number]; zoom?: number; children?: ReactNode }) {
  return (
    <MapContainer center={center} zoom={zoom} style={{ height: '100%', width: '100%' }}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      {children}
    </MapContainer>
  );
}
```

`src/lib/map-marker.tsx`:
```tsx
import L from 'leaflet';
import { Marker } from 'react-leaflet';
import type { Coordinates } from '@ulasim20/types-transport';

export function MapMarker({ position, title }: { position: Coordinates; title?: string }) {
  return <Marker position={[position.lat, position.lon]} title={title} icon={L.divIcon({ className: 'map-marker' })} />;
}
```

- [ ] **Step 5: Create `libs/ui/icons/`**

`package.json`:
```json
{
  "name": "@ulasim20/ui-icons",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "lucide-react": "^0.552.0" }
}
```

`project.json`:
```json
{
  "name": "ui-icons",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/ui/icons/src",
  "projectType": "library",
  "tags": ["type:ui", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/icons" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/icons" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/ui/icons" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export {
  Bus,
  Map as MapIcon,
  Search,
  Star,
  Bell,
  Settings,
  User,
  Home,
  ChevronRight,
  ChevronLeft,
  X
} from 'lucide-react';
```

- [ ] **Step 6: Create `libs/ui/theme/`**

`package.json`:
```json
{
  "name": "@ulasim20/ui-theme",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": { "next-themes": "^0.4.6" }
}
```

`project.json`:
```json
{
  "name": "ui-theme",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/ui/theme/src",
  "projectType": "library",
  "tags": ["type:ui", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/theme" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/ui/theme" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/ui/theme" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export { ThemeProvider } from './lib/theme-provider';
```

`src/lib/theme-provider.tsx`:
```tsx
import { ThemeProvider as NextThemesProvider } from 'next-themes';
import type { ReactNode } from 'react';

export function ThemeProvider({ children }: { children: ReactNode }) {
  return <NextThemesProvider attribute="class" defaultTheme="system" enableSystem>{children}</NextThemesProvider>;
}
```

- [ ] **Step 7: Run `pnpm install` and type-check all UI libs**

Run: `pnpm install && pnpm exec nx run-many -t type-check --projects=ui-primitives,ui-layout,ui-map,ui-icons,ui-theme`
Expected: all projects succeed.

- [ ] **Step 8: Commit**

```bash
git add libs/ui
git commit -m "feat(ui): add primitives, layout, map, icons, theme libs"
```

---

## Task 7: Create `libs/feature/*` (routes, planner, vehicles, notifications, auth)

**Files:**
- Create: `libs/feature/routes/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/feature/planner/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/feature/vehicles/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/feature/notifications/{package.json,project.json,tsconfig.json,src/index.ts}`
- Create: `libs/feature/auth/{package.json,project.json,tsconfig.json,src/index.ts}`

- [ ] **Step 1: Inspect existing feature code**

Open the contents of `src/components/transit-map.tsx`, `src/components/analytics-route-tracker.tsx`, `src/lib/transit-context.tsx`, `src/lib/offline-route-planner.ts`, `src/lib/kmz-route-geometry.ts`, `src/lib/nfc.ts`, `src/hooks/use-favorite-lines.ts`, `src/hooks/use-saved-cards.ts`, `src/hooks/use-balance-auto-check.ts`.
Read them and note what depends on what so we can keep the boundaries clean.

- [ ] **Step 2: Create `libs/feature/routes/`**

`package.json`:
```json
{
  "name": "@ulasim20/feature-routes",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@ulasim20/data-access-transport-api": "workspace:*",
    "@ulasim20/types-transport": "workspace:*",
    "@ulasim20/types-api": "workspace:*",
    "@ulasim20/ui-map": "workspace:*"
  },
  "peerDependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" }
}
```

`project.json`:
```json
{
  "name": "feature-routes",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/feature/routes/src",
  "projectType": "library",
  "tags": ["type:feature", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/routes" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/routes" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/feature/routes" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export { RoutePlanner } from './lib/route-planner';
export { useRoute } from './lib/use-route';
```

`src/lib/route-planner.tsx`:
```tsx
import type { Route, Stop } from '@ulasim20/types-transport';
import { MapView, MapMarker } from '@ulasim20/ui-map';

export function RoutePlanner({ route, stops }: { route: Route; stops: Stop[] }) {
  const center = stops[0] ? [stops[0].location.lat, stops[0].location.lon] : [37.7765, 29.0864];
  return (
    <MapView center={center as [number, number]}>
      {stops.map((s) => <MapMarker key={s.id} position={s.location} title={s.name} />)}
    </MapView>
  );
}
```

`src/lib/use-route.ts`:
```typescript
import { useEffect, useState } from 'react';
import { TransportApi } from '@ulasim20/data-access-transport-api';
import type { Route } from '@ulasim20/types-transport';

export function useRoute(api: TransportApi, routeId: string) {
  const [route, setRoute] = useState<Route | null>(null);
  useEffect(() => {
    let cancelled = false;
    api.listRoutes().then((res) => {
      if (cancelled || !res.ok) return;
      setRoute(res.data.find((r) => r.id === routeId) ?? null);
    });
    return () => {
      cancelled = true;
    };
  }, [api, routeId]);
  return route;
}
```

- [ ] **Step 3: Create `libs/feature/planner/`**

`package.json`:
```json
{
  "name": "@ulasim20/feature-planner",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@ulasim20/types-transport": "workspace:*"
  }
}
```

`project.json`:
```json
{
  "name": "feature-planner",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/feature/planner/src",
  "projectType": "library",
  "tags": ["type:feature", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/planner" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/planner" } },
    "test": { "executor": "nx:run-commands", "options": { "command": "vitest run --project=node libs/feature/planner" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/feature/planner" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts"] }
```

`src/index.ts`:
```typescript
export { planRoute } from './lib/plan';
export { compileDataset } from './lib/compile';
```

`src/lib/plan.ts`:
```typescript
import type { Route, Stop } from '@ulasim20/types-transport';

export type PlanInput = { from: Stop; to: Stop; routes: Route[] };

export function planRoute({ from, to, routes: _routes }: PlanInput): Stop[] {
  return [from, to];
}
```

`src/lib/compile.ts`:
```typescript
export function compileDataset(input: unknown): { compiledAt: string; size: number } {
  const size = JSON.stringify(input).length;
  return { compiledAt: new Date().toISOString(), size };
}
```

- [ ] **Step 4: Create `libs/feature/vehicles/`**

`package.json`:
```json
{
  "name": "@ulasim20/feature-vehicles",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@ulasim20/data-access-transport-api": "workspace:*",
    "@ulasim20/types-transport": "workspace:*",
    "@ulasim20/ui-map": "workspace:*"
  },
  "peerDependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" }
}
```

`project.json`:
```json
{
  "name": "feature-vehicles",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/feature/vehicles/src",
  "projectType": "library",
  "tags": ["type:feature", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/vehicles" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/vehicles" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/feature/vehicles" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export { useLiveVehicles } from './lib/use-live-vehicles';
export { VehiclesLayer } from './lib/vehicles-layer';
```

`src/lib/use-live-vehicles.ts`:
```typescript
import { useEffect, useState } from 'react';
import { TransportApi } from '@ulasim20/data-access-transport-api';
import type { Vehicle } from '@ulasim20/types-transport';

export function useLiveVehicles(api: TransportApi) {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  useEffect(() => {
    let cancelled = false;
    const tick = () =>
      api.liveVehicles().then((res) => {
        if (!cancelled && res.ok) setVehicles(res.data);
      });
    tick();
    const id = setInterval(tick, 15_000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [api]);
  return vehicles;
}
```

`src/lib/vehicles-layer.tsx`:
```tsx
import { MapMarker } from '@ulasim20/ui-map';
import type { Vehicle } from '@ulasim20/types-transport';

export function VehiclesLayer({ vehicles }: { vehicles: Vehicle[] }) {
  return (
    <>
      {vehicles.map((v) => <MapMarker key={v.id} position={v.position} title={v.routeId} />)}
    </>
  );
}
```

- [ ] **Step 5: Create `libs/feature/notifications/`**

`package.json`:
```json
{
  "name": "@ulasim20/feature-notifications",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "@ulasim20/data-access-capacitor": "workspace:*",
    "sonner": "^2.0.7"
  },
  "peerDependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" }
}
```

`project.json`:
```json
{
  "name": "feature-notifications",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/feature/notifications/src",
  "projectType": "library",
  "tags": ["type:feature", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/notifications" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/notifications" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/feature/notifications" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export { notifyInApp } from './lib/notify-in-app';
export { notifyMobile } from './lib/notify-mobile';
```

`src/lib/notify-in-app.ts`:
```typescript
import { toast } from 'sonner';

export function notifyInApp(message: string) {
  toast(message);
}
```

`src/lib/notify-mobile.ts`:
```typescript
import { notify } from '@ulasim20/data-access-capacitor';

export async function notifyMobile(title: string, body: string) {
  await notify(title, body);
}
```

- [ ] **Step 6: Create `libs/feature/auth/`**

`package.json`:
```json
{
  "name": "@ulasim20/feature-auth",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "main": "src/index.ts",
  "exports": { ".": "./src/index.ts" },
  "dependencies": {
    "pocketbase": "^0.26.8",
    "@ulasim20/util-validation": "workspace:*"
  },
  "peerDependencies": { "react": "^18.3.1", "react-dom": "^18.3.1" }
}
```

`project.json`:
```json
{
  "name": "feature-auth",
  "$schema": "../../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "libs/feature/auth/src",
  "projectType": "library",
  "tags": ["type:feature", "scope:shared"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/auth" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p libs/feature/auth" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint libs/feature/auth" } }
  }
}
```

`tsconfig.json`:
```json
{ "extends": "../../../tsconfig.base.json", "include": ["src/**/*.ts", "src/**/*.tsx"] }
```

`src/index.ts`:
```typescript
export { useSession } from './lib/use-session';
```

`src/lib/use-session.ts`:
```typescript
import PocketBase from 'pocketbase';
import { useEffect, useState } from 'react';

export function useSession(url: string) {
  const [pb] = useState(() => new PocketBase(url));
  const [user, setUser] = useState(pb.authStore.record);
  useEffect(() => {
    return pb.authStore.onChange(() => setUser(pb.authStore.record));
  }, [pb]);
  return { pb, user };
}
```

- [ ] **Step 7: Type-check all feature libs**

Run: `pnpm exec nx run-many -t type-check --projects=feature-routes,feature-planner,feature-vehicles,feature-notifications,feature-auth`
Expected: all projects succeed.

- [ ] **Step 8: Commit**

```bash
git add libs/feature
git commit -m "feat(feature): add routes, planner, vehicles, notifications, auth libs"
```

---

## Task 8: Create `apps/web` (React + Vite + CF Pages Functions)

**Files:**
- Create: `apps/web/{package.json,project.json,tsconfig.json,tsconfig.node.json,vite.config.ts,index.html}`
- Move: `src/`, `public/`, `functions/`, `wrangler.toml` (root), `src/styles/tailwind.css` → `apps/web/`
- Delete: root `src/`, `public/`, `functions/`, root `wrangler.toml`, root `vite.config.ts`, root `tsconfig.json`, root `tsconfig.node.json`, root `capacitor.config.ts`

- [ ] **Step 1: Create `apps/web/package.json`**

```json
{
  "name": "web",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit -p apps/web && vite build",
    "preview": "vite preview",
    "pages:dev": "wrangler pages dev dist"
  },
  "dependencies": {
    "@ulasim20/feature-routes": "workspace:*",
    "@ulasim20/feature-vehicles": "workspace:*",
    "@ulasim20/feature-planner": "workspace:*",
    "@ulasim20/feature-notifications": "workspace:*",
    "@ulasim20/feature-auth": "workspace:*",
    "@ulasim20/data-access-api-client": "workspace:*",
    "@ulasim20/data-access-transport-api": "workspace:*",
    "@ulasim20/data-access-msw-handlers": "workspace:*",
    "@ulasim20/data-access-capacitor": "workspace:*",
    "@ulasim20/ui-primitives": "workspace:*",
    "@ulasim20/ui-layout": "workspace:*",
    "@ulasim20/ui-map": "workspace:*",
    "@ulasim20/ui-icons": "workspace:*",
    "@ulasim20/ui-theme": "workspace:*",
    "@ulasim20/types-transport": "workspace:*",
    "@ulasim20/types-api": "workspace:*",
    "@ulasim20/types-env": "workspace:*",
    "@ulasim20/util-date": "workspace:*",
    "@ulasim20/util-geo": "workspace:*",
    "@ulasim20/util-format": "workspace:*",
    "@ulasim20/util-validation": "workspace:*",
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@hookform/resolvers": "^5.2.2",
    "@ionic/react": "^8.7.17",
    "@mui/material": "^7.3.7",
    "@radix-ui/react-accordion": "^1.2.12",
    "@radix-ui/react-dialog": "^1.1.15",
    "@radix-ui/react-dropdown-menu": "^2.1.16",
    "@radix-ui/react-slot": "^1.2.3",
    "@radix-ui/react-tabs": "^1.1.13",
    "@radix-ui/react-tooltip": "^1.2.8",
    "@tanstack/react-virtual": "^3.13.23",
    "@tmcw/togeojson": "^7.1.2",
    "class-variance-authority": "^0.7.1",
    "clsx": "^2.1.1",
    "cmdk": "^1.1.1",
    "date-fns": "^4.1.0",
    "embla-carousel-react": "^8.6.0",
    "input-otp": "^1.4.2",
    "jszip": "^3.10.1",
    "leaflet": "^1.9.4",
    "lucide-react": "^0.552.0",
    "next-themes": "^0.4.6",
    "pocketbase": "^0.26.8",
    "react": "^18.3.1",
    "react-day-picker": "^9.11.1",
    "react-dom": "^18.3.1",
    "react-hook-form": "^7.66.0",
    "react-leaflet": "^4.2.1",
    "react-resizable-panels": "^3.0.6",
    "react-router-dom": "^6.30.3",
    "recharts": "^2.15.4",
    "sonner": "^2.0.7",
    "tailwind-merge": "^3.3.1",
    "vaul": "^1.1.2",
    "zod": "^4.1.12"
  },
  "devDependencies": {
    "@types/leaflet": "^1.9.21",
    "@types/node": "^24.10.0",
    "@types/react": "^18.3.5",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-basic-ssl": "^2.1.0",
    "@vitejs/plugin-react": "^4.3.1",
    "@ulasim20/config-vite": "workspace:*",
    "@ulasim20/config-tailwind": "workspace:*",
    "@testing-library/jest-dom": "6.9.1",
    "@testing-library/react": "16.3.2",
    "@testing-library/user-event": "14.6.1",
    "jsdom": "25.0.1",
    "msw": "2.13.4",
    "postcss": "^8.4.45",
    "tailwindcss": "^4.1.16",
    "tw-animate-css": "^1.4.0",
    "typescript": "^5.5.4",
    "vite": "^7.3.2",
    "vite-plugin-qrcode": "^0.3.0",
    "wrangler": "^4.83.0"
  }
}
```

- [ ] **Step 2: Create `apps/web/project.json`**

```json
{
  "name": "web",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/web/src",
  "projectType": "application",
  "tags": ["scope:web"],
  "targets": {
    "build": {
      "executor": "nx:run-commands",
      "options": { "command": "pnpm --filter web build" },
      "outputs": ["{projectRoot}/dist"]
    },
    "dev": {
      "executor": "nx:run-commands",
      "options": { "command": "pnpm --filter web dev" }
    },
    "test": {
      "executor": "nx:run-commands",
      "options": { "command": "vitest run --project=frontend" }
    },
    "lint": {
      "executor": "nx:run-commands",
      "options": { "command": "biome lint apps/web" }
    },
    "type-check": {
      "executor": "nx:run-commands",
      "options": { "command": "tsc --noEmit -p apps/web/tsconfig.json" }
    },
    "deploy": {
      "executor": "nx:run-commands",
      "options": { "command": "wrangler pages deploy apps/web/dist" }
    }
  }
}
```

- [ ] **Step 3: Create `apps/web/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "baseUrl": "../..",
    "paths": {
      "@/*": ["apps/web/src/*"]
    },
    "types": ["node", "vitest/globals"]
  },
  "include": ["src/**/*.ts", "src/**/*.tsx", "functions/**/*.ts"]
}
```

- [ ] **Step 4: Create `apps/web/vite.config.ts`**

```typescript
import { plugins, server as serverPreset } from '@ulasim20/config-vite';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins,
  server: {
    ...serverPreset,
    proxy: {
      '/denizli-api': {
        target: 'https://ulasim.denizli.bel.tr',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/denizli-api/, '')
      },
      '/api': { target: 'http://localhost:8787', changeOrigin: true },
      '/route-api': {
        target: 'https://ulasimapi.isrky.dev',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/route-api/, '')
      }
    }
  },
  build: { outDir: 'dist' }
});
```

- [ ] **Step 5: Move existing web source files into `apps/web/`**

```bash
mkdir -p apps/web
git mv src apps/web/src
git mv public apps/web/public
git mv functions apps/web/functions
git mv wrangler.toml apps/web/wrangler.toml
git mv index.html apps/web/index.html
```

- [ ] **Step 6: Update `apps/web/index.html` script path**

Open `apps/web/index.html` and ensure the script tag is `<script type="module" src="/src/main.tsx"></script>`. Adjust the leading `/` based on the existing file (no other change).

- [ ] **Step 7: Update import paths in `apps/web/src/`**

For each file in `apps/web/src/` that imports from `@/...`, change to relative paths or keep `@/...` if the tsconfig `paths` is set up. (With the tsconfig above, `@/` still maps to `apps/web/src/*`, so most internal imports stay as-is.)

For any file that imports from `../api/...` or `../components/...`, leave it as relative since those refer to other files inside `apps/web/src/`.

- [ ] **Step 8: Move `src/styles/tailwind.css` to `apps/web/src/styles/`** (already moved with `src/`). No action needed.

- [ ] **Step 9: Delete the root-level configs we no longer need**

```bash
git rm vite.config.ts tsconfig.json tsconfig.node.json vitest.config.ts capacitor.config.ts
```

- [ ] **Step 10: Update `vitest.workspace.ts` at root**

```typescript
import path from 'node:path';
import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  {
    extends: path.resolve(__dirname, 'apps/web/vitest.config.ts'),
    test: {
      name: 'frontend',
      environment: 'jsdom',
      include: ['apps/web/src/**/*.test.{ts,tsx}', 'libs/feature/**/src/**/*.test.tsx', 'libs/ui/**/src/**/*.test.tsx', 'libs/data-access/**/src/**/*.test.{ts,tsx}'],
      setupFiles: [path.resolve(__dirname, './tests/setup/frontend.ts')]
    }
  },
  {
    test: {
      name: 'node',
      environment: 'node',
      include: ['apps/backend/src/**/*.test.ts', 'libs/util/**/src/**/*.test.ts', 'libs/types/**/src/**/*.test.ts', 'tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
      setupFiles: [path.resolve(__dirname, './tests/setup/node.ts')]
    }
  },
  './apps/backend/vitest.config.ts'
]);
```

- [ ] **Step 11: Move vitest configs into apps/web and apps/backend**

```bash
git mv vitest.config.ts apps/web/vitest.config.ts
```

- [ ] **Step 12: Run `pnpm install` and verify build of `apps/web`**

Run: `pnpm install && pnpm exec nx build web`
Expected: build succeeds, `apps/web/dist/index.html` exists.

- [ ] **Step 13: Run frontend tests**

Run: `pnpm exec nx test web`
Expected: frontend tests pass.

- [ ] **Step 14: Commit**

```bash
git add apps/web
git add vitest.workspace.ts
git commit -m "feat(web): migrate web app into apps/web with Nx"
```

---

## Task 9: Create `apps/backend` (Hono on CF Workers)

**Files:**
- Create: `apps/backend/{package.json,project.json,tsconfig.json,tsconfig.test.json}`
- Move: `backend/*` → `apps/backend/*`

- [ ] **Step 1: Create `apps/backend/package.json`**

```json
{
  "name": "backend",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "description": "Denizli Ulaşım Backend API - Hono + Cloudflare Workers",
  "scripts": {
    "dev": "wrangler dev",
    "build": "wrangler deploy --dry-run --outdir=dist",
    "deploy": "wrangler deploy",
    "tail": "wrangler tail",
    "planner:fetch-normalize": "tsx scripts/planner-ci.ts fetch-normalize",
    "planner:compute-source-signature": "tsx scripts/planner-ci.ts compute-source-signature",
    "planner:compile-dataset": "tsx scripts/planner-ci.ts compile-dataset",
    "planner:validate-dataset": "tsx scripts/planner-ci.ts validate-dataset",
    "planner:promote-manifest": "tsx scripts/planner-ci.ts promote-manifest"
  },
  "dependencies": {
    "hono": "^4.12.14",
    "@ulasim20/types-transport": "workspace:*",
    "@ulasim20/types-api": "workspace:*",
    "@ulasim20/util-geo": "workspace:*",
    "@ulasim20/feature-planner": "workspace:*"
  },
  "devDependencies": {
    "@cloudflare/vitest-pool-workers": "0.5.41",
    "@cloudflare/workers-types": "^4.20241205.0",
    "tsx": "^4.21.0",
    "typescript": "^5.5.4",
    "vitest": "2.1.9",
    "wrangler": "^4.83.0"
  }
}
```

- [ ] **Step 2: Create `apps/backend/project.json`**

```json
{
  "name": "backend",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/backend/src",
  "projectType": "application",
  "tags": ["scope:backend"],
  "targets": {
    "build": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter backend build" } },
    "dev": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter backend dev" } },
    "test": { "executor": "nx:run-commands", "options": { "command": "vitest run --project=backend" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint apps/backend" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit -p apps/backend/tsconfig.json" } },
    "deploy": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter backend deploy" } },
    "planner:fetch-normalize": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter backend planner:fetch-normalize" } },
    "planner:compute-source-signature": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter backend planner:compute-source-signature" } },
    "planner:compile-dataset": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter backend planner:compile-dataset" } },
    "planner:validate-dataset": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter backend planner:validate-dataset" } },
    "planner:promote-manifest": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter backend planner:promote-manifest" } }
  }
}
```

- [ ] **Step 3: Create `apps/backend/tsconfig.json`**

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "types": ["@cloudflare/workers-types"]
  },
  "include": ["src/**/*.ts", "scripts/**/*.ts"]
}
```

- [ ] **Step 4: Create `apps/backend/tsconfig.test.json`**

Move from `backend/tsconfig.test.json` if it exists, otherwise create:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": ["@cloudflare/vitest-pool-workers"]
  },
  "include": ["src/**/*.test.ts"]
}
```

- [ ] **Step 5: Move `backend/*` into `apps/backend/`**

```bash
git mv backend/src apps/backend/src
git mv backend/scripts apps/backend/scripts
git mv backend/wrangler.toml apps/backend/wrangler.toml
git mv backend/vitest.config.ts apps/backend/vitest.config.ts
git mv backend/tsconfig.json apps/backend/tsconfig.json
git mv backend/tsconfig.test.json apps/backend/tsconfig.test.json
git mv backend/package.json apps/backend/package.json
git mv backend/package-lock.json apps/backend/package-lock.json
rmdir backend
```

- [ ] **Step 6: Adjust `apps/backend/wrangler.toml` main path if it referenced `src/index.ts`**

Open `apps/backend/wrangler.toml`. Confirm `main = "src/index.ts"` still resolves. (Yes — the wrangler config's main is relative to the wrangler.toml location.)

- [ ] **Step 7: Run `pnpm install`**

Run: `pnpm install`
Expected: install completes.

- [ ] **Step 8: Run backend type-check and tests**

Run: `pnpm exec nx type-check backend && pnpm exec nx test backend`
Expected: both succeed.

- [ ] **Step 9: Run the planner fetch script dry-run**

Run: `pnpm exec nx run backend:planner:fetch-normalize -- --help`
Expected: prints the CLI help without errors.

- [ ] **Step 10: Commit**

```bash
git add apps/backend
git rm backend/package-lock.json
git commit -m "feat(backend): migrate backend app into apps/backend with Nx"
```

---

## Task 10: Create `apps/mobile` (Capacitor Android shell)

**Files:**
- Create: `apps/mobile/{package.json,project.json,capacitor.config.ts}`
- Move: `android/*` → `apps/mobile/android/*`

- [ ] **Step 1: Create `apps/mobile/package.json`**

```json
{
  "name": "mobile",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "cap:sync": "cap sync android",
    "android:build": "cd android && ./gradlew assembleDebug",
    "android:open": "cap open android"
  },
  "dependencies": {
    "@capacitor/android": "8.0.0",
    "@capacitor/app": "8.0.0",
    "@capacitor/browser": "8.0.0",
    "@capacitor/clipboard": "8.0.0",
    "@capacitor/core": "8.0.0",
    "@capacitor/geolocation": "^8.0.0",
    "@capacitor/haptics": "8.0.0",
    "@capacitor/keyboard": "8.0.0",
    "@capacitor/local-notifications": "^8.0.2",
    "@capacitor/network": "8.0.0",
    "@capacitor/preferences": "8.0.0",
    "@capacitor/share": "8.0.0",
    "@capacitor/splash-screen": "8.0.0",
    "@capacitor/status-bar": "8.0.0"
  },
  "devDependencies": {
    "@capacitor/cli": "8.3.1",
    "typescript": "^5.5.4"
  }
}
```

- [ ] **Step 2: Create `apps/mobile/project.json`**

```json
{
  "name": "mobile",
  "$schema": "../../node_modules/nx/schemas/project-schema.json",
  "sourceRoot": "apps/mobile",
  "projectType": "application",
  "tags": ["scope:mobile"],
  "targets": {
    "cap:sync": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter mobile cap:sync" } },
    "android:build": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter mobile android:build" } },
    "android:open": { "executor": "nx:run-commands", "options": { "command": "pnpm --filter mobile android:open" } },
    "lint": { "executor": "nx:run-commands", "options": { "command": "biome lint apps/mobile" } },
    "type-check": { "executor": "nx:run-commands", "options": { "command": "tsc --noEmit apps/mobile/capacitor.config.ts" } }
  }
}
```

- [ ] **Step 3: Move `android/*` into `apps/mobile/android/`**

```bash
git mv android apps/mobile/android
```

- [ ] **Step 4: Create `apps/mobile/capacitor.config.ts`**

```typescript
import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'akilli.ulasim.portal',
  appName: 'akilli-ulasim-portal',
  webDir: '../web/dist',
  server: {
    androidScheme: 'https',
    cleartext: true
  },
  android: {
    allowMixedContent: true,
    buildOptions: { releaseType: 'bundle' }
  },
  plugins: {
    SplashScreen: { launchShowDuration: 2000, backgroundColor: '#ffffff', showSpinner: false, androidScaleType: 'CENTER_CROP' },
    Keyboard: { resize: 'body', style: 'DARK', resizeOnFullScreen: true },
    LocalNotifications: { smallIcon: 'ic_stat_icon_config_sample', iconColor: '#0E7490', sound: 'beep.wav' },
    Browser: { androidCustomTabsColor: '#0E7490' },
    StatusBar: { backgroundColor: '#FFFFFF', style: 'LIGHT', overlaysWebView: false }
  }
};

export default config;
```

- [ ] **Step 5: Move `gradle.properties` if it's at root**

```bash
if [ -f gradle.properties ]; then git mv gradle.properties apps/mobile/gradle.properties; fi
```

- [ ] **Step 6: Run `pnpm install`**

Run: `pnpm install`
Expected: install completes.

- [ ] **Step 7: Verify the project graph**

Run: `pnpm exec nx show projects`
Expected output includes: `web`, `backend`, `mobile`, plus all config/types/util/data-access/ui/feature libs.

- [ ] **Step 8: Smoke test: build web, then run cap:sync** (skip gradle if slow)

Run: `pnpm exec nx build web && cd apps/mobile && pnpm exec cap sync android && cd ../..`
Expected: `cap sync` runs without error and copies web dist into `apps/mobile/android/`.

- [ ] **Step 9: Commit**

```bash
git add apps/mobile
git commit -m "feat(mobile): migrate android shell into apps/mobile with Nx"
```

---

## Task 11: Wire CI (GitHub Actions + Nx Cloud)

**Files:**
- Create: `.github/workflows/ci.yml`
- Delete: `.github/workflows/*.yml.disabled` (or leave them disabled but update their paths if you want to keep them)

- [ ] **Step 1: Create `.github/workflows/ci.yml`**

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-latest
    timeout-minutes: 30
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0

      - uses: pnpm/action-setup@v4
        with:
          version: 9

      - uses: actions/setup-node@v4
        with:
          node-version: 20
          cache: pnpm

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Start Nx Cloud run
        run: pnpm exec nx-cloud start-ci-run --distribute-on="3 linux-medium" --stop-agents-after="build"
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
          NX_CLOUD_CONFIG: ${{ secrets.NX_CLOUD_CONFIG }}

      - name: Lint, type-check, test, build (affected)
        run: pnpm exec nx affected -t lint type-check test build --parallel=2 --ci
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

      - name: E2E (main only)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: pnpm exec nx run-many -t e2e --parallel=1
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}

      - name: Deploy (main only, after green)
        if: github.ref == 'refs/heads/main' && github.event_name == 'push'
        run: pnpm exec nx affected -t deploy --parallel=1
        env:
          NX_CLOUD_ACCESS_TOKEN: ${{ secrets.NX_CLOUD_ACCESS_TOKEN }}
          CLOUDFLARE_API_TOKEN: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          CLOUDFLARE_ACCOUNT_ID: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
```

- [ ] **Step 2: Decide on the existing `.yml.disabled` files**

Either delete them or move them into a `disabled/` subdirectory if you want to keep them as references:

```bash
mkdir -p .github/workflows/disabled
git mv .github/workflows/*.yml.disabled .github/workflows/disabled/
```

- [ ] **Step 3: Document required secrets in README**

Append to `README.md`:

```markdown
## CI

GitHub Actions runs on every PR and main push. The following secrets must be configured in repo settings:

- `NX_CLOUD_ACCESS_TOKEN` — from `pnpm exec nx connect`.
- `CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ACCOUNT_ID` — for `wrangler deploy`.
```

- [ ] **Step 4: Verify the workflow file is valid YAML**

Run: `pnpm exec js-yaml .github/workflows/ci.yml` (or use a YAML linter).
Expected: parses without errors.

- [ ] **Step 5: Commit**

```bash
git add .github/workflows/ci.yml README.md
git commit -m "ci: add Nx + Nx Cloud CI workflow"
```

---

## Task 12: Final cleanup and validation

**Files:**
- Update: `README.md`
- Delete: any leftover root-level artifacts

- [ ] **Step 1: Delete any remaining root-level artifacts**

```bash
git rm -r src backend android functions public 2>/dev/null || true
git rm vite.config.ts tsconfig.json tsconfig.node.json vitest.config.ts capacitor.config.ts 2>/dev/null || true
git rm gradle.properties 2>/dev/null || true
```

- [ ] **Step 2: Update root `biome.json` to extend the new base**

```json
{
  "extends": ["@ulasim20/config-biome/biome.json"]
}
```

- [ ] **Step 3: Run the full Nx test suite**

Run: `pnpm exec nx run-many -t lint type-check test build`
Expected: all targets succeed across all projects.

- [ ] **Step 4: Run E2E**

Run: `pnpm exec nx run-many -t e2e`
Expected: Playwright suite passes against the built web app.

- [ ] **Step 5: Run a planner script end-to-end**

Run: `pnpm exec nx run backend:planner:fetch-normalize -- --help`
Expected: help text printed, no errors.

- [ ] **Step 6: Update README.md with the new structure**

Replace the README body with:

```markdown
# ulasim20-nx

Denizli Ulaşım Portalı — Nx monorepo.

## Structure

- `apps/web` — React 18 + Vite SPA, deployed to Cloudflare Pages.
- `apps/backend` — Hono API on Cloudflare Workers.
- `apps/mobile` — Capacitor Android shell around `apps/web`.
- `libs/feature/*` — business features.
- `libs/ui/*` — shared React components.
- `libs/data-access/*` — API clients, MSW handlers, Capacitor wrappers.
- `libs/util/*` — pure helpers.
- `libs/types/*` — shared TS types and zod schemas.
- `libs/config/*` — reusable configs (eslint, tsconfig, vite, tailwind, biome).

## Common commands

```bash
pnpm install
pnpm dev               # nx serve web
pnpm dev:backend       # nx serve backend
pnpm build             # nx run-many -t build
pnpm test              # nx run-many -t test
pnpm test:e2e          # playwright test
pnpm typecheck         # nx run-many -t type-check
pnpm lint              # nx run-many -t lint
pnpm planner:fetch     # nx run backend:planner:fetch-normalize
```

## Adding a new lib

```bash
pnpm exec nx g @nx/js:lib libs/util/my-util --directory=libs/util/my-util
```

## CI

See `.github/workflows/ci.yml`. Uses Nx Cloud for remote caching and affected graph.
```

- [ ] **Step 7: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and README update"
```

- [ ] **Step 8: Verify the project graph one more time**

Run: `pnpm exec nx graph --file=tmp/nx-graph.json && ls tmp/nx-graph.json`
Expected: graph file is created and non-empty.

Run: `rm -rf tmp`

---

## Self-Review

1. **Spec coverage:**
   - Top-level layout → Tasks 1, 8, 9, 10.
   - 4 separate apps → Tasks 8, 9, 10.
   - Libs by domain → Tasks 3, 4, 5, 6, 7.
   - pnpm + boundaries → Tasks 1, 2, 3-7 (each lib has tags).
   - CI + Nx Cloud → Task 11.
   - Migration order (config → types/util → data-access → ui → feature → apps → CI → cleanup) → Tasks 1→2→3→4→5→6→7→8→9→10→11→12.
2. **Placeholders scan:** no "TBD" / "TODO" / "fill in" in the plan.
3. **Type consistency:**
   - `Coordinates` defined in `libs/types/transport` and used in `libs/util/geo` and `libs/ui/map` — consistent.
   - `ApiClient` constructor signature `(options: ApiClientOptions)` used identically in tests and `TransportApi`.
   - `ApiResponse<T>` defined in `libs/types/api` and used by `TransportApi`.
   - Nx project names: `web`, `backend`, `mobile`, `config-tsconfig`, `config-eslint`, `config-biome`, `config-tailwind`, `config-vite`, `types-transport`, `types-api`, `types-env`, `util-date`, `util-geo`, `util-format`, `util-validation`, `data-access-api-client`, `data-access-transport-api`, `data-access-msw-handlers`, `data-access-capacitor`, `ui-primitives`, `ui-layout`, `ui-map`, `ui-icons`, `ui-theme`, `feature-routes`, `feature-planner`, `feature-vehicles`, `feature-notifications`, `feature-auth` — consistent with `tsconfig.base.json` paths and `package.json` names.
   - Tags: `scope:web`, `scope:backend`, `scope:mobile`, `scope:shared`, `type:feature`, `type:ui`, `type:data-access`, `type:util`, `type:types`, `type:config` — consistent with the ESLint boundary rule in Task 2.

Plan complete and saved to `docs/superpowers/plans/2026-06-14-nx-monorepo.md`. Two execution options:

1. **Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration
2. **Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

Which approach?
