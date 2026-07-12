# Requirements clarification

## Q1: What is the deployment target?

**Answer:** Homelab Docker stack under `~/infra`, same as fretted.io. Image `registry.fretted.io/gempixel:latest`, site `https://gempixel.io`, reload via `~/infra/reload-gempixel.sh`.

## Q2: What is the default branch?

**Answer:** `master` (gempixel repo convention; fretted uses `main`).

## Q3: What does CI run on pull requests?

**Answer:** `npm ci` → `npm test` (178 Vitest tests) → `npm run build` → `verify-web-export.sh`.

## Q4: What build tool replaces Expo export?

**Answer:** `npm run build` (`tsc && vite build`) produces `dist/` with hashed `/assets/index-*.js` bundles.

## Q5: Self-hosted runner configuration?

**Answer:** New `gempixel-runner` service in `~/infra/runner`, labels `self-hosted,linux,x64,gempixel`, repo-scoped to `Black-Maple-Code/gempixel`.

## Q6: Release versioning?

**Answer:** Same as fretted — semver tags without `v` prefix, patch by default, PR labels `release:minor` / `release:major`, direct pushes to master fail.
