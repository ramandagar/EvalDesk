# EvalDesk Launch Promo

`render.sh` creates a 40-second 1920x1080 MP4 launch video using the real EvalDesk gallery assets in `marketing/`.

## Story

1. The evaluation problem: agents move quickly, quality needs checking.
2. Plain-English test cases.
3. Run and review responses.
4. The domain-expert audience.
5. Regression protection and reports.
6. Open-source call to action.

## Render

```bash
bash marketing/promo/render.sh
```

The finished video is written to `marketing/promo/out/evaldesk-launch-promo-1080p.mp4`.

This file is intentionally built with FFmpeg only, so it can be rendered on a clean development machine without external media, accounts, or API keys.
