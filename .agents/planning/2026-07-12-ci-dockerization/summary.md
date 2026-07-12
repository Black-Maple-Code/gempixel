# Project summary: CI and Dockerization

## Artifacts created

### Repo (implemented)

| Path | Purpose |
|------|---------|
| `.github/workflows/web-ci.yml` | PR CI: test + build + verify |
| `.github/workflows/release.yml` | Release, Docker push, homelab deploy |
| `docker/Dockerfile` | Multi-stage Vite build → nginx |
| `docker/nginx.conf` | SPA serving with cache headers |
| `.dockerignore` | Lean build context |
| `scripts/verify-web-export.sh` | Post-build integrity check |
| `scripts/publish-web.sh` | Manual image publish |
| `docs/deploy.md` | Operator documentation |

### Planning

| Path | Purpose |
|------|---------|
| `rough-idea.md` | Initial concept |
| `idea-honing.md` | Consolidated requirements |
| `research/fretted-mirror.md` | fretted comparison |
| `design/detailed-design.md` | Full design |
| `implementation/plan.md` | Step checklist |

## Key design decisions

- **Vite build** replaces Expo export; verify scripts check `/assets/index-*.js`.
- **Branch `master`** matches gempixel repo (fretted uses `main`).
- **Runner label `gempixel`** — new homelab compose service required.
- **Registry image** `registry.fretted.io/gempixel:latest` (open registry, same as fretted).

## Next steps

1. **Commit and push** these files to GitHub.
2. **Homelab setup** (Step 6 in implementation plan):
   - Add `gempixel-runner` to `~/infra/runner`
   - Create `~/infra/gempixel/docker-compose.yml` and `reload-gempixel.sh`
   - Point gempixel.io DNS/TLS at the new service
3. **Branch protection** — require Web CI on `master`.
4. **First deploy** — merge a PR to `master` and confirm release workflow completes.

## Open items

- Confirm production URL is `https://gempixel.io` (assumed from fretted.io pattern).
- Homelab infra files are not in this repo — must be created on the server.
