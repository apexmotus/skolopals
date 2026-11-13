# Turborepo & Shared Packages Design

This document specifies the root workspace configuration (`pnpm-workspace.yaml`, `package.json`, `turbo.json`, `tsconfig.base.json`) and the exact contracts of `@skolopals/shared` and `@skolopals/ui`.

---

## 1. Root Workspace Configuration

### 1.1 `pnpm-workspace.yaml` (Repository Root)

Unifies the frontend apps, shared frontend packages, and the existing `api/` NestJS application under `pnpm` 10:

```yaml
packages:
  - "apps/*"
  - "packages/*"
  - "api"
```

> `db/` is intentionally excluded from `pnpm-workspace.yaml` because it is a SQL/Makefile/Python workspace with no `package.json`.

### 1.2 `package.json` (Repository Root)

```json
{
  "name": "skolopals-monorepo",
  "private": true,
  "packageManager": "pnpm@10.10.0",
  "engines": {
    "node": "24.x"
  },
  "scripts": {
    "dev": "turbo run dev",
    "dev:client": "turbo run dev --filter=@skolopals/client",
    "dev:admin": "turbo run dev --filter=@skolopals/admin",
    "dev:api": "turbo run start:dev --filter=skolopals-api",
    "build": "turbo run build",
    "lint": "turbo run lint",
    "typecheck": "turbo run typecheck",
    "test": "turbo run test"
  },
  "devDependencies": {
    "turbo": "^2.5.0",
    "typescript": "^5.8.0"
  }
}
```

### 1.3 `turbo.json` (Repository Root)

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "tui",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "env": [
        "API_URL",
        "NEXT_PUBLIC_SUPABASE_URL",
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
        "NEXT_PUBLIC_SITE_URL"
      ],
      "outputs": [".next/**", "!.next/cache/**", "dist/**"]
    },
    "lint": {
      "dependsOn": ["^lint"]
    },
    "typecheck": {
      "dependsOn": ["^typecheck"]
    },
    "test": {
      "dependsOn": ["^build"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "start:dev": {
      "cache": false,
      "persistent": true
    }
  }
}
```

### 1.4 `tsconfig.base.json` (Repository Root)

Shared TypeScript configuration extended by `apps/client/tsconfig.json`, `apps/admin/tsconfig.json`, `packages/ui/tsconfig.json`, and `packages/shared/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2017",
    "lib": ["dom", "dom.iterable", "esnext"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "bundler",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "react-jsx",
    "incremental": true
  }
}
```

---

## 2. `@skolopals/shared` (`packages/shared/`)

### 2.1 Why Just-in-Time (Source) Exports

`@skolopals/shared` contains Next.js server-only modules (`import "server-only"`, `next/headers`, `next/navigation`, React `cache()`). Using Turborepo's **Internal Package** pattern — exporting `.ts` source files directly and transpiling them inside `apps/client` and `apps/admin` via Next.js's `transpilePackages: ["@skolopals/shared", "@skolopals/ui"]` — avoids a separate compile step, preserves React Server Component module graph boundaries (`server-only`), and provides instant HMR across workspace packages.

### 2.2 `packages/shared/package.json`

```json
{
  "name": "@skolopals/shared",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./database.types": "./src/database.types.ts",
    "./api": "./src/api/client.ts",
    "./supabase/server": "./src/supabase/server.ts",
    "./supabase/client": "./src/supabase/client.ts",
    "./auth": "./src/auth.ts",
    "./format": "./src/format.ts",
    "./reference": "./src/reference.ts"
  },
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit",
    "test": "node --test src/format.test.mts"
  },
  "dependencies": {
    "@supabase/ssr": "^0.12.7",
    "@supabase/supabase-js": "^2.118.0",
    "server-only": "^0.0.1"
  },
  "peerDependencies": {
    "next": "16.4.2",
    "react": "19.3.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "eslint": "^9",
    "typescript": "^5"
  }
}
```

### 2.3 Internal Imports Within `packages/shared/src/`

When moving files from `web/src/lib/*` into `packages/shared/src/*`, replace the old app-local `@/lib/*` path aliases with relative imports so `@skolopals/shared` does not depend on consumer `tsconfig` path mappings:

- `packages/shared/src/api/client.ts`:
  - Change `import { createClient } from "@/lib/supabase/server"` → `import { createClient } from "../supabase/server"`
- `packages/shared/src/supabase/server.ts` & `client.ts`:
  - Change `import type { Database } from "@/lib/database.types"` → `import type { Database } from "../database.types"`
- `packages/shared/src/auth.ts`:
  - Change `@/lib/api/client` → `./api/client`
  - Change `@/lib/supabase/server` → `./supabase/server`
  - Change `@/lib/database.types` → `./database.types`
- `packages/shared/src/reference.ts`:
  - Change `@/lib/api/client` → `./api/client`

### 2.4 Updating `db/Makefile` for `database.types.ts`

Update line 104 of `db/Makefile` (and `db/README.md` / root `README.md`) so `make types` writes directly to `@skolopals/shared`:

```makefile
types:
	@python3 scripts/gen-types.py ../packages/shared/src/database.types.ts
```

---

## 3. `@skolopals/ui` (`packages/ui/`)

### 3.1 `packages/ui/package.json`

```json
{
  "name": "@skolopals/ui",
  "version": "0.1.0",
  "private": true,
  "exports": {
    "./globals.css": "./src/styles/globals.css",
    "./ui": "./src/ui.tsx",
    "./logo": "./src/logo.tsx",
    "./nav-link": "./src/nav-link.tsx",
    "./coming-soon": "./src/coming-soon.tsx",
    "./app-shell": "./src/app-shell.tsx"
  },
  "scripts": {
    "lint": "eslint src/",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@skolopals/shared": "workspace:*",
    "lucide-react": "^1.59.0"
  },
  "peerDependencies": {
    "next": "16.4.2",
    "react": "19.3.0",
    "react-dom": "19.3.0"
  },
  "devDependencies": {
    "@types/node": "^20",
    "@types/react": "^19",
    "@types/react-dom": "^19",
    "eslint": "^9",
    "typescript": "^5"
  }
}
```

### 3.2 Refactoring `AppShell` (`packages/ui/src/app-shell.tsx`) for Dependency Inversion

In the current monolith, `web/src/components/app-shell.tsx` directly imports `signOut` from `@/app/(auth)/actions` and hardcodes `<Link href="/contact">Help</Link>`. In a shared UI package:

1. **Inject `signOutAction` via props** (`signOutAction: () => Promise<void>`) instead of importing an app-level Server Action.
2. **Make `helpHref` optional** (`helpHref?: string | null`, defaulting to `"/contact"` in `apps/client` and `null` in `apps/admin` since `apps/admin` has no public `/contact` page).
3. Replace `@/components/*` and `@/lib/*` imports inside `packages/ui/src/app-shell.tsx`:
   - `import { NavLink } from "./nav-link";`
   - `import { Logo } from "./logo";`
   - `import { initials } from "@skolopals/shared/format";`
   - `import type { AppRole, Row } from "@skolopals/shared/database.types";`

Updated `AppShell` signature in `packages/ui/src/app-shell.tsx`:

```tsx
export function AppShell({
  profile,
  role,
  subtitle,
  signOutAction,
  helpHref,
  children,
}: {
  profile: Row<"profiles">;
  role: AppRole;
  subtitle?: string;
  signOutAction: () => Promise<void>;
  helpHref?: string | null;
  children: ReactNode;
})
```

When `helpHref` is provided (e.g., `helpHref="/contact"` in `apps/client`'s `parent`, `learner`, and `tutor` layouts), the `Help` pill link renders; when omitted in `apps/admin/src/app/admin/layout.tsx`, only the `Log out` action renders.

### 3.3 Tailwind CSS v4 Source Scanning (`packages/ui/src/styles/globals.css`)

Tailwind CSS v4 automatically scans the active application root (`apps/client` or `apps/admin`), which means classes used exclusively inside `packages/ui/src/*.tsx` would be missed unless registered via `@source`. Add `@source "../";` at the top of `packages/ui/src/styles/globals.css`:

```css
@import "tailwindcss";
@source "../";

:root {
  /* existing Skolopals CSS variables */
}
```

Each app's `src/app/layout.tsx` then imports `@skolopals/ui/globals.css` directly (or via a 1-line `src/app/globals.css` containing `@import "@skolopals/ui/globals.css";`).
