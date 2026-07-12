# Rough idea

Setup CI and dockerization for the gempixel repo, mirroring the setup in `../fretted`.

This is a Vite + Preact static website (not a React Native / Expo app), but the deployment pattern is the same:

1. Run tests on pull requests
2. On merge to default branch: run tests, build Docker image, push to `registry.fretted.io`, create semver GitHub Release, trigger homelab reload via self-hosted runner
