#!/usr/bin/env bash

# EvalDesk launch promo: 40 seconds, 1920x1080, no external media required.
# Requires ffmpeg. Run from the repository root:
#   bash marketing/promo/render.sh

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUT_DIR="$ROOT/marketing/promo/out"
OUT_FILE="$OUT_DIR/evaldesk-launch-promo-1080p.mp4"
FONT="/System/Library/Fonts/Supplemental/Verdana.ttf"

mkdir -p "$OUT_DIR"

if ! command -v ffmpeg >/dev/null 2>&1; then
  echo "ffmpeg is required to render this video."
  exit 1
fi

for asset in \
  "$ROOT/marketing/gallery_01_hero_1270x760.png" \
  "$ROOT/marketing/gallery_02_features_1270x760.png" \
  "$ROOT/marketing/gallery_03_usecases_1270x760.png"; do
  if [[ ! -f "$asset" ]]; then
    echo "Missing required asset: $asset"
    exit 1
  fi
done

# Compose the typography into transparent-safe scene PNGs first. This avoids
# relying on FFmpeg's optional drawtext build feature, which is absent in some
# package-manager installations.
SCENE_DIR="$OUT_DIR/scenes"
mkdir -p "$SCENE_DIR"

base_scene() {
  magick "$1" -resize 1920x1080^ -gravity center -extent 1920x1080 \
    -fill 'rgba(0,0,0,0.34)' -colorize 34% "$2"
}

base_scene "$ROOT/marketing/gallery_01_hero_1270x760.png" "$SCENE_DIR/scene-01.png"
magick "$SCENE_DIR/scene-01.png" -font "$FONT" -gravity north \
  -fill white -pointsize 66 -annotate +0+122 'AI agents ship fast.' \
  -fill '#B8D935' -pointsize 66 -annotate +0+207 'But who checks the answers?' \
  -fill '#CBD0D8' -pointsize 28 -annotate +0+317 'EvalDesk gives domain experts a seat at the table.' \
  "$SCENE_DIR/scene-01.png"

base_scene "$ROOT/marketing/gallery_02_features_1270x760.png" "$SCENE_DIR/scene-02.png"
magick "$SCENE_DIR/scene-02.png" -fill 'rgba(0,0,0,0.82)' -draw 'rectangle 0,0 1920,190' \
  -font "$FONT" -gravity northwest -fill white -pointsize 52 -annotate +90+58 'Write test cases in plain English.' \
  -fill '#B8D935' -pointsize 26 -annotate +93+127 'No JSON. No Python. No engineering handoff.' \
  "$SCENE_DIR/scene-02.png"

base_scene "$ROOT/marketing/gallery_01_hero_1270x760.png" "$SCENE_DIR/scene-03.png"
magick "$SCENE_DIR/scene-03.png" -fill 'rgba(0,0,0,0.86)' -draw 'rectangle 0,890 1920,1080' \
  -font "$FONT" -gravity southwest -fill white -pointsize 50 -annotate +90+95 'Run your agent. Review every response.' \
  -fill '#B8D935' -pointsize 26 -annotate +93+35 'Pass. Partial. Fail. Then see the trend.' \
  "$SCENE_DIR/scene-03.png"

base_scene "$ROOT/marketing/gallery_03_usecases_1270x760.png" "$SCENE_DIR/scene-04.png"
magick "$SCENE_DIR/scene-04.png" -fill 'rgba(0,0,0,0.85)' -draw 'rectangle 0,0 1920,210' \
  -font "$FONT" -gravity north -fill white -pointsize 44 -annotate +0+54 'Built for the people who know what correct means.' \
  -fill '#B8D935' -pointsize 24 -annotate +0+128 'Doctors  |  Lawyers  |  Teachers  |  Compliance  |  QA' \
  "$SCENE_DIR/scene-04.png"

base_scene "$ROOT/marketing/gallery_02_features_1270x760.png" "$SCENE_DIR/scene-05.png"
magick "$SCENE_DIR/scene-05.png" -fill 'rgba(0,0,0,0.88)' -draw 'rectangle 0,855 1920,1080' \
  -font "$FONT" -gravity south -fill white -pointsize 50 -annotate +0+115 'Catch regressions before your users do.' \
  -fill '#B8D935' -pointsize 25 -annotate +0+48 'Human review + LLM-as-judge + shareable reports.' \
  "$SCENE_DIR/scene-05.png"

base_scene "$ROOT/marketing/gallery_01_hero_1270x760.png" "$SCENE_DIR/scene-06.png"
magick "$SCENE_DIR/scene-06.png" -fill 'rgba(0,0,0,0.72)' -colorize 72% \
  -font "$FONT" -gravity north -fill white -pointsize 82 -annotate +0+255 'EvalDesk' \
  -fill '#B8D935' -pointsize 42 -annotate +0+365 'Test AI agents without writing code.' \
  -fill '#CBD0D8' -pointsize 27 -annotate +0+457 'Open source  •  Self-hostable  •  No-code' \
  -fill '#B8D935' -draw 'roundrectangle 605,565 1315,637 18,18' \
  -gravity north -fill '#0A0A0A' -pointsize 27 -annotate +0+585 'github.com/ramandagar/EvalDesk' \
  "$SCENE_DIR/scene-06.png"

# Every scene has a gentle Ken Burns movement and a 0.6s dissolve. The copy is
# intentionally minimal: the viewer should understand EvalDesk before reading
# anything long.
ffmpeg -y \
  -loop 1 -t 6 -i "$SCENE_DIR/scene-01.png" \
  -loop 1 -t 7 -i "$SCENE_DIR/scene-02.png" \
  -loop 1 -t 7 -i "$SCENE_DIR/scene-03.png" \
  -loop 1 -t 7 -i "$SCENE_DIR/scene-04.png" \
  -loop 1 -t 6 -i "$SCENE_DIR/scene-05.png" \
  -loop 1 -t 7 -i "$SCENE_DIR/scene-06.png" \
  -filter_complex "
    [0:v]zoompan=z='min(zoom+0.00022,1.08)':d=180:s=1920x1080:fps=30,format=yuv420p[s0];
    [1:v]zoompan=z='min(zoom+0.00018,1.07)':d=210:s=1920x1080:fps=30,format=yuv420p[s1];
    [2:v]zoompan=z='min(zoom+0.00020,1.08)':d=210:s=1920x1080:fps=30,format=yuv420p[s2];
    [3:v]zoompan=z='min(zoom+0.00018,1.07)':d=210:s=1920x1080:fps=30,format=yuv420p[s3];
    [4:v]zoompan=z='min(zoom+0.00020,1.08)':d=180:s=1920x1080:fps=30,format=yuv420p[s4];
    [5:v]zoompan=z='min(zoom+0.00016,1.06)':d=210:s=1920x1080:fps=30,format=yuv420p[s5];
    [s0][s1]xfade=transition=fade:duration=0.6:offset=5.4[x1];
    [x1][s2]xfade=transition=fade:duration=0.6:offset=11.8[x2];
    [x2][s3]xfade=transition=fade:duration=0.6:offset=18.2[x3];
    [x3][s4]xfade=transition=fade:duration=0.6:offset=24.6[x4];
    [x4][s5]xfade=transition=fade:duration=0.6:offset=30.0,format=yuv420p[v]
  " \
  -map "[v]" \
  -r 30 \
  -c:v libx264 \
  -crf 18 \
  -preset medium \
  -movflags +faststart \
  "$OUT_FILE"

echo "Rendered: $OUT_FILE"
