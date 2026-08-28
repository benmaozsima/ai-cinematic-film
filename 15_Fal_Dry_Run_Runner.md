# Fal Dry-Run Runner

Date: 2026-08-28

Purpose: local cost-guarded tool for planning Fal video generation requests without spending credits.

## Files

| File | Purpose |
| --- | --- |
| `tools/fal_runner/fal_runner.py` | Builds and validates Fal request payloads. Refuses execution unless explicitly enabled. |
| `config/fal_models.json` | Manual model registry and schema mapping. |
| `data/sample_shot_request.json` | Example dry-run shot request. |
| `tools/fal_runner/README.md` | Usage notes. |

## Safety Behavior

Default behavior is dry-run only.

Paid generation requires both:

1. command flag `--execute`,
2. shot JSON value `budget.dry_run=false`.

Without both, the runner only prints the planned payload.

## Verified Dry Run

Command:

```bash
python3 tools/fal_runner/fal_runner.py \
  --models config/fal_models.json \
  --shot data/sample_shot_request.json
```

Result:

- Built a valid Seedance 2.5 image-to-video payload.
- Did not call Fal.
- Did not use paid credits.
- Warned that price is not configured.

Generated payload:

```json
{
  "prompt": "A cinematic test shot based on an approved keyframe. Slow handheld push-in, subtle atmospheric movement, restrained motion, realistic lighting, no new characters.",
  "resolution": "720p",
  "duration": 4,
  "generate_audio": false,
  "bitrate_mode": "standard",
  "image_url": "https://example.com/start-frame.jpg"
}
```

## Next Needed Improvement

Add verified price data per model from Fal account/dashboard before enabling paid generation.

Until prices are configured, every estimate returns:

```text
No price configured for this model; external account/dashboard estimate required.
```
