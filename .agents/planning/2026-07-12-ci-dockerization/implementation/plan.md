# Implementation plan

Convert the design into a series of implementation steps that will build each component in a test-driven manner following agile best practices. Each step must result in a working, demoable increment of functionality.

## Checklist

- [x] Step 1: Verify scripts and build integrity checks
- [x] Step 2: Docker image (Dockerfile + nginx + .dockerignore)
- [x] Step 3: PR CI workflow
- [x] Step 4: Release and deploy workflow
- [x] Step 5: Documentation and manual publish script
- [ ] Step 6: Homelab infra (runner, compose, reload script, DNS) — server-side

---

## Step 1: Verify scripts and build integrity checks

**Objective:** Ensure production builds are verifiable before Docker or CI depend on them.

**Guidance:** Adapt fretted's `verify-web-export.sh` for Vite's `/assets/index-*.js` pattern.

**Tests:** Run `npm run build && ./scripts/verify-web-export.sh dist` locally.

**Integration:** Used by CI, Dockerfile, and release workflow.

**Demo:** Script prints `OK: /assets/index-*.js (...)` after a successful build.

---

## Step 2: Docker image

**Objective:** Package `dist/` as an nginx-served container image.

**Guidance:** Multi-stage Dockerfile mirroring fretted; nginx SPA config without Expo-specific paths.

**Tests:** `docker build -f docker/Dockerfile .` succeeds; container serves index.html on port 80.

**Integration:** Consumed by `publish-web.sh` and release workflow.

**Demo:** `docker run -p 8080:80 <image>` serves GemPixel at localhost:8080.

---

## Step 3: PR CI workflow

**Objective:** Gate merges with tests and production build.

**Guidance:** `.github/workflows/web-ci.yml` on `pull_request` → `master`.

**Tests:** Workflow itself is the test harness; local equivalent is `npm ci && npm test && npm run build`.

**Integration:** Recommended as required check on `master`.

**Demo:** Open PR → GitHub Actions "Web CI" job goes green.

---

## Step 4: Release and deploy workflow

**Objective:** Automate image publish, semver release, and homelab reload.

**Guidance:** `.github/workflows/release.yml` mirrors fretted; deploy job needs `gempixel` runner.

**Tests:** Release job runs tests before push; deploy triggers homelab reload.

**Integration:** Depends on homelab runner and reload script (Step 6).

**Demo:** Merge PR → image pushed → site updated at gempixel.io.

---

## Step 5: Documentation and manual publish

**Objective:** Document the pipeline and support manual publishes.

**Guidance:** `docs/deploy.md`, `scripts/publish-web.sh`, PDD artifacts.

**Tests:** `./scripts/publish-web.sh` builds and pushes (requires Docker + registry access).

**Integration:** Complements automated release workflow.

**Demo:** Developer can publish without merging to master.

---

## Step 6: Homelab infra (server-side)

**Objective:** Create server-side pieces not stored in this repo.

**Guidance:** Mirror fretted infra:

- Add `gempixel-runner` to `~/infra/runner/docker-compose.yml`
- Create `~/infra/gempixel/docker-compose.yml` pulling `registry.fretted.io/gempixel:latest`
- Create `~/infra/reload-gempixel.sh`
- Configure DNS/TLS for gempixel.io

**Tests:** Runner shows online in GitHub; manual `./reload-gempixel.sh` updates container.

**Integration:** Unblocks deploy job in release workflow.

**Demo:** Full end-to-end deploy on PR merge without manual intervention.
