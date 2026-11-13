#!/bin/sh
# Slim the Body-page GLBs to at most 1.5 MB each (~25k triangles, Draco).
#
# Pipeline per model (challenge-fit item 4):
#   1. tools/slim-textures.py -- JPEG re-encode plus photo PNGs to a
#      256-colour palette (same pixel sizes, same look);
#   2. gltf-transform prune -- drop empty nodes, dedupe samplers, fold
#      solid-colour textures into material factors;
#   3. gltf-transform simplify -- Decimate to about 25,000 triangles;
#   4. gltf-transform draco -- compress geometry
#      (--quantize-position 11 --quantize-normal 8 --quantize-texcoord 10).
# Node names, pivots and proportions are unchanged, so body-map anchors
# still sit on the body.
#
# Needs: python3 with PIL, and network access for npx.
# Usage: sh tools/slim-body-models.sh <workdir>
# The script rebuilds male+female from the current public/models files into
# <workdir> for review; copy the verified outputs back by hand.
set -eu
cd "$(dirname "$0")/.."

if [ "$#" -ne 1 ]; then
  echo "usage: sh tools/slim-body-models.sh <workdir>" >&2
  exit 1
fi
WORK="$1"
mkdir -p "$WORK"
GTF="npx -y @gltf-transform/cli@4.5.1"

slim_one() { # src stem jpeg_q ratio
  src="$1"; stem="$2"; q="$3"; ratio="$4"
  python3 tools/slim-textures.py "$src" "$WORK/$stem-tex.glb" "$q"
  $GTF prune "$WORK/$stem-tex.glb" "$WORK/$stem-prune.glb" --keep-leaves false
  $GTF simplify "$WORK/$stem-prune.glb" "$WORK/$stem-sim.glb" --ratio "$ratio" --error 0.02
  $GTF draco "$WORK/$stem-sim.glb" "$WORK/$stem-final.glb" \
    --quantize-position 11 --quantize-normal 8 --quantize-texcoord 10
  ls -la "$WORK/$stem-final.glb"
}

# Tunings that produced the shipped files (male 963,304 bytes / 25,224 tris,
# female 1,162,760 bytes / 25,433 tris):
slim_one public/models/body-male.glb male 75 0.415
slim_one public/models/body-female.glb female 70 0.31
