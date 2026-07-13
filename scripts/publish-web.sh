#!/usr/bin/env bash
# Build and push the gempixel web image to registry.gem-pixel.com.
# Registry is open for now — no docker login required.
set -euo pipefail

SCRIPT_DIR="$(dirname "$(realpath "$0")")"
REPO_ROOT="$(dirname "${SCRIPT_DIR}")"
cd "${REPO_ROOT}"

IMAGE="registry.gem-pixel.com/gempixel"
TAG="${1:-latest}"

echo "Building ${IMAGE}:${TAG} (linux/amd64)..."
docker build --platform linux/amd64 --no-cache \
  -f docker/Dockerfile \
  -t "${IMAGE}:${TAG}" \
  .

echo "Pushing ${IMAGE}:${TAG}..."
docker push "${IMAGE}:${TAG}"

echo "Done. On the server, reload:"
echo "  cd ~/infra && ./reload-gempixel.sh"
