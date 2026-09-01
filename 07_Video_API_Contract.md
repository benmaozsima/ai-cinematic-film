# Video API Contract - v1

Purpose: expose one stable API that lets Codex manage AI film shots without caring which provider runs behind it: Seedance, Veo, Kling, Runway, fal, Replicate, BytePlus, or another service.

The API should be provider-agnostic, cost-aware, and traceable back to the Shot Database.

## Dialogue and lip-sync contract

Each request must include `dialogue_visibility`, `audio_mode`, `lip_sync_required`, `voice_asset_id`, `transcript_hebrew`, `timing_asset`, `speaker_id` and `pronunciation_notes` (or explicit `null` values for silent shots). `visible_speaker` requires `lip_sync_required: true`; the API must reject it without an approved voice asset and timing plan. Exact Hebrew is supplied as data for recording/lip-sync and remains selectable HTML in the dashboard, never text rendered inside a generated frame. See `36_Audio_LipSync_Contract_v0.1.md` for routing and QC rules.

Recommended default for visible speech is a silent visual generation followed by an audio-driven lip-sync pass. Native model audio is an explicitly labelled experiment, not proof of Hebrew pronunciation or mouth synchronization.

## Core Requirements

- Every generation must have a stable `job_id`.
- Every request must include our `shot_id`.
- Every result must return model/provider, cost estimate, duration, resolution, status, output URL/path, and error details if failed.
- The API must support dry runs so prompts/settings can be validated without spending money.
- The API must support image-to-video and first/last-frame workflows.
- The API must not silently choose expensive models unless `quality_tier` allows it.

## Quality Tiers

| Tier | Purpose | Expected Behavior |
| --- | --- | --- |
| `draft` | Cheap motion/composition test | Low cost, lower resolution, short duration. |
| `standard` | Serious candidate generation | Good quality, controlled cost. |
| `hero` | Final/high-value shot | Best suitable model, higher cost allowed. |

## Endpoint 1 - List Capabilities

`GET /v1/capabilities`

Returns available providers, models, limits, and supported features.

Example response:

```json
{
  "providers": [
    {
      "provider": "fal",
      "models": [
        {
          "model": "bytedance/seedance-2.0/image-to-video",
          "supports_text_to_video": true,
          "supports_image_to_video": true,
          "supports_first_last_frame": false,
          "supports_reference_images": true,
          "supports_native_audio": true,
          "max_duration_seconds": 15,
          "resolutions": ["720p", "1080p"],
          "aspect_ratios": ["16:9", "9:16", "1:1"],
          "estimated_cost_per_second_usd": 0.08
        }
      ]
    }
  ]
}
```

## Endpoint 2 - Generate Shot

`POST /v1/generate-shot`

Request:

```json
{
  "shot_id": "SHOT_001",
  "scene_id": "SCENE_001",
  "version": "v1",
  "quality_tier": "draft",
  "mode": "image_to_video",
  "preferred_provider": "auto",
  "preferred_model": "auto",
  "duration_seconds": 5,
  "aspect_ratio": "16:9",
  "resolution": "720p",
  "prompt": "Cinematic war-drama shot...",
  "negative_prompt": "no extra fingers, no logo drift, no subtitles, no text artifacts",
  "camera": {
    "movement": "slow handheld push-in",
    "lens": "35mm anamorphic feel",
    "framing": "medium close-up"
  },
  "references": {
    "start_frame_url": "https://...",
    "end_frame_url": null,
    "reference_image_urls": ["https://..."],
    "reference_video_urls": []
  },
  "constraints": {
    "preserve_character_ids": ["CHAR_001"],
    "preserve_location_ids": ["LOC_001"],
    "no_new_characters": true,
    "no_text_or_logos": true
  },
  "budget": {
    "max_cost_usd": 1.5,
    "dry_run": false
  },
  "metadata": {
    "purpose": "test commander close-up identity and radio performance",
    "notes": "Use approved keyframe only."
  }
}
```

Response:

```json
{
  "job_id": "job_abc123",
  "shot_id": "SHOT_001",
  "status": "queued",
  "provider": "fal",
  "model": "bytedance/seedance-2.0/image-to-video",
  "estimated_cost_usd": 0.42,
  "estimated_completion_seconds": 90,
  "created_at": "2026-08-28T00:00:00Z"
}
```

## Endpoint 3 - Check Job

`GET /v1/jobs/{job_id}`

Response:

```json
{
  "job_id": "job_abc123",
  "shot_id": "SHOT_001",
  "status": "succeeded",
  "provider": "fal",
  "model": "bytedance/seedance-2.0/image-to-video",
  "output": {
    "video_url": "https://...",
    "thumbnail_url": "https://...",
    "duration_seconds": 5,
    "resolution": "720p",
    "aspect_ratio": "16:9"
  },
  "cost": {
    "estimated_cost_usd": 0.42,
    "actual_cost_usd": 0.39
  },
  "error": null,
  "created_at": "2026-08-28T00:00:00Z",
  "completed_at": "2026-08-28T00:01:24Z"
}
```

## Endpoint 4 - Download Result

`GET /v1/jobs/{job_id}/download`

Returns the generated video file, or a signed download URL:

```json
{
  "job_id": "job_abc123",
  "download_url": "https://...",
  "expires_at": "2026-08-29T00:00:00Z"
}
```

## Endpoint 5 - Estimate Cost

`POST /v1/estimate`

Same body as `/v1/generate-shot`, but never generates.

Response:

```json
{
  "shot_id": "SHOT_001",
  "recommended_provider": "fal",
  "recommended_model": "bytedance/seedance-2.0/image-to-video",
  "estimated_cost_usd": 0.42,
  "warnings": [
    "Hero tier requested but resolution is only 720p.",
    "No start frame supplied; identity consistency may be weak."
  ]
}
```

## Model Selection Logic

If `preferred_model` is `auto`, the API should select by shot need:

| Need | Preferred Model Family |
| --- | --- |
| Cheap motion test | Seedance fast / Wan fast / Kling fast |
| Character consistency | Runway Gen-4.5 / Seedance with references |
| First-last-frame control | Veo 3.1 / Kling 3 |
| Native audio | Veo 3.1 / Seedance 2.5 if available |
| Cinematic hero shot | Veo 3.1 / Runway Gen-4.5 / Seedance 2.5 |

## Safety And Budget Rules

- Default `dry_run` should be true unless explicitly disabled.
- Reject generation if estimated cost is above `max_cost_usd`.
- Reject batch jobs unless every shot has a budget.
- Store provider raw responses for debugging, but return normalized fields.
- Keep prompts, settings, cost, model, and output linked to `shot_id` and `version`.

## Minimal MVP

The first implementation only needs:

- `GET /v1/capabilities`
- `POST /v1/estimate`
- `POST /v1/generate-shot`
- `GET /v1/jobs/{job_id}`

Download can initially be a `video_url` returned from the job status.

## Environment Variables

Recommended:

```text
FAL_KEY=
REPLICATE_API_TOKEN=
BYTEPLUS_API_KEY=
RUNWAY_API_KEY=
DEFAULT_DAILY_BUDGET_USD=10
DEFAULT_SHOT_BUDGET_USD=1.5
```

## Codex Integration

Once this API exists, Codex can:

1. Read the Shot Database.
2. Select the next `READY` shot.
3. Send an estimate request.
4. Ask for approval if cost/quality tier is high.
5. Generate the shot.
6. Poll until complete.
7. Download or inspect result.
8. Update Experiment Log and Shot Database with verdict.
