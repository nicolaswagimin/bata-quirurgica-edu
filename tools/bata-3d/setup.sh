#!/usr/bin/env bash
# Installs MPFB in an isolated Blender profile (tools/bata-3d/.work), leaving the user's Blender
# configuration untouched. Source of the environment for every run: env.sh.
set -euo pipefail
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/env.sh"
mkdir -p "$BLENDER_USER_EXTENSIONS" "$BLENDER_USER_CONFIG" "$BLENDER_USER_SCRIPTS" "$BLENDER_USER_DATAFILES"
blender --online-mode --command extension sync
blender --online-mode --command extension install mpfb --enable
