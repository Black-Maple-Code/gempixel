#!/bin/sh
# Fail if dist/index.html references a JS bundle that is not present on disk.
set -eu

DIST="${1:-dist}"

if [ ! -f "${DIST}/index.html" ]; then
  echo "ERROR: ${DIST}/index.html not found"
  exit 1
fi

BUNDLE="$(grep -oE '/assets/index-[^"]+\.js' "${DIST}/index.html" | head -1 || true)"
if [ -z "${BUNDLE}" ]; then
  echo "ERROR: No script bundle reference in ${DIST}/index.html"
  exit 1
fi

FILE="${DIST}${BUNDLE}"
if [ ! -f "${FILE}" ]; then
  echo "ERROR: index.html references ${BUNDLE} but ${FILE} is missing"
  exit 1
fi

ASSET_FILES="$(find "${DIST}/assets" -type f 2>/dev/null | wc -l | tr -d ' ')"
if [ "${ASSET_FILES}" -lt 1 ]; then
  echo "ERROR: ${DIST}/assets has no exported files"
  exit 1
fi

echo "OK: ${BUNDLE} ($(wc -c < "${FILE}" | tr -d ' ') bytes, ${ASSET_FILES} asset files)"
