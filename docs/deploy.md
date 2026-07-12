# Deploying gempixel.io (web)

Automated deployment via GitHub Actions. Static Vite production build → Docker → `registry.gem-pixel.com` → homelab reload.

Mirrors the [fretted.io deploy pipeline](https://github.com/Black-Maple-Code/fretted/blob/main/docs/deploy.md).

## Workflows

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| [`.github/workflows/web-ci.yml`](../.github/workflows/web-ci.yml) | Pull request → `master` | `npm test` + `npm run build` |
| [`.github/workflows/release.yml`](../.github/workflows/release.yml) | Push → `master` (merged PR) | Semver release, Docker push, homelab reload |

**Merge policy:** Direct pushes to `master` fail the release job. Merge via PR.

**Version bumps:** Default patch. Add PR labels `release:minor` or `release:major` to override (not both).

## Local publish (manual)

```bash
chmod +x scripts/*.sh   # first time only
./scripts/publish-web.sh
cd ~/infra && ./reload-gempixel.sh   # on homelab
```

## Self-hosted runner

Add a **`gempixel-runner`** Compose service under **`~/infra/runner`** on the homelab (mirror `fretted-runner`):

- Repo: `Black-Maple-Code/gempixel`
- Labels: `self-hosted`, `linux`, `x64`, `gempixel`
- Mounts: `/var/run/docker.sock`, `/home/smith/infra`

Example service block (add to `~/infra/runner/docker-compose.yml`):

```yaml
  gempixel-runner:
    image: myoung34/github-runner:latest
    env_file: .env.gempixel
    environment:
      REPO_URL: https://github.com/Black-Maple-Code/gempixel
      RUNNER_NAME: gempixel
      LABELS: self-hosted,linux,x64,gempixel
      RUNNER_SCOPE: repo
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      - /home/smith/infra:/home/smith/infra
```

Verify:

```bash
cd ~/infra/runner
docker compose up -d gempixel-runner
docker compose logs -f gempixel-runner
```

GitHub → repo Settings → Actions → Runners should show **`gempixel`** idle.

Deploy job uses `runs-on: [self-hosted, gempixel]` and runs `/home/smith/infra/reload-gempixel.sh`.

## Homelab infra (server-side)

These files live on the homelab under `~/infra` and are **not** in this repo:

| Path | Purpose |
|------|---------|
| `~/infra/gempixel/docker-compose.yml` | App service pulling `registry.gem-pixel.com/gempixel:latest` |
| `~/infra/reload-gempixel.sh` | `docker compose pull && docker compose up -d` for gempixel |

Mirror the existing fretted stack layout when creating these.

## Branch protection (recommended)

Require the **Web CI** check on `master` before merge.

## Deferred

- Registry authentication (`docker login`)
- Per-version Docker image tags (`:1.0.3`)

See `.agents/planning/2026-07-12-ci-dockerization/design/detailed-design.md`.
