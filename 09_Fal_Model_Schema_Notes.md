# Fal Model Schema Notes - Initial Pass

Date: 2026-08-28

Scope: schema/capability research only. No paid generation has been run.

## Safety Rule

Do not submit paid generation jobs without explicit approval from Ben.

Allowed before approval:

- Read documentation.
- Build dry-run request payloads.
- Estimate cost from configured price tables.
- Validate local JSON shape.
- Prepare prompts and references.

Not allowed without approval:

- `fal.queue.submit(...)`
- `fal.subscribe(...)`
- Any endpoint that creates media or consumes paid credits.

## Fal Queue Pattern

Fal recommends asynchronous inference for production model calls:

1. Submit request.
2. Store `request_id`.
3. Poll status or use webhook.
4. Retrieve result.

Observed lifecycle states:

| Status | Meaning |
| --- | --- |
| `IN_QUEUE` | Request accepted and waiting for a runner. |
| `IN_PROGRESS` | Runner is processing. |
| `COMPLETED` | Result is available. |

The API returns tracking URLs such as `response_url`, `status_url`, and `cancel_url`.

## Seedance 2.5 Image-To-Video

Model ID:

```text
bytedance/seedance-2.5/image-to-video
```

Best use:

- Cinematic image-to-video from approved keyframes.
- Longer single-shot motion tests.
- Shots where audio may be useful.
- Potential hero/standard shots after testing.

Input schema:

| Field | Required | Notes |
| --- | --- | --- |
| `prompt` | Yes | Motion/action prompt. |
| `image_url` | Yes | Starting frame, JPEG/PNG/WebP, max 30 MB. |
| `end_image_url` | No | Last frame for transition control. |
| `resolution` | No | `480p`, `720p`, `1080p`; default `720p`. |
| `duration` | No | `auto` or 4-30 seconds. |
| `aspect_ratio` | No | Always `auto` for image-to-video. |
| `generate_audio` | No | Default `true`; cost documented as same regardless of audio. |
| `bitrate_mode` | No | `standard` or `high`; default `standard`. |
| `end_user_id` | No | Optional user identifier. |

Output:

| Field | Notes |
| --- | --- |
| `video.url` | Generated MP4 URL. |
| `seed` | Seed used. |

Production notes:

- Strong first candidate for our `image_to_video` tests.
- Start with 4-5 seconds at 720p for draft tests.
- Use 1080p/high bitrate only for approved hero attempts.
- Use `end_image_url` when the ending composition matters.

## Seedance 2.0 Image-To-Video

Model ID:

```text
bytedance/seedance-2.0/image-to-video
```

Best use:

- Controlled image-to-video.
- Testing whether 2.0 is cheaper/faster than 2.5 for drafts.
- Shots where 4K may matter, depending on current account availability.

Input schema differences noted:

| Field | Notes |
| --- | --- |
| `resolution` | `480p`, `720p`, `1080p`, `4k`. |
| `duration` | `auto` or 4-15 seconds. |
| `aspect_ratio` | `auto`, `21:9`, `16:9`, `4:3`, `1:1`, `3:4`, `9:16`. |
| `generate_audio` | Default `true`. |
| `bitrate_mode` | `standard` or `high`. |

Production notes:

- Test if 2.0 gives better aspect ratio control and/or 4K access.
- Good candidate for short 5-8 second cinematic tests.

## Veo 3.1 First/Last Frame To Video

Model ID:

```text
fal-ai/veo3.1/first-last-frame-to-video
```

Best use:

- Precisely controlled cinematic beat with known start and end frames.
- Reveals, turns, impacts, entrances/exits, transitions.
- Shots where endpoint continuity matters more than broad creative improvisation.

Input schema:

| Field | Required | Notes |
| --- | --- | --- |
| `prompt` | Yes | Describes desired video and motion between frames. |
| `first_frame_url` | Yes | First frame. |
| `last_frame_url` | Yes | Last frame. |
| `aspect_ratio` | No | `auto`, `16:9`, `9:16`; default `auto`. |
| `duration` | No | `4s`, `6s`, `8s`; default `8s`. |
| `negative_prompt` | No | Avoid unwanted artifacts. |
| `resolution` | No | `720p`, `1080p`, `4k`; default `720p`. |
| `generate_audio` | No | Default `true`. |
| `seed` | No | Optional repeatability. |
| `auto_fix` | No | Allows prompt rewrite for policy/validation failures. |
| `safety_tolerance` | No | API-only, `1`-`6`, default `4`. |

Output:

| Field | Notes |
| --- | --- |
| `video.url` | Generated MP4 URL. |

Production notes:

- This is our first-choice endpoint for designed A-to-B action.
- Use when we approve two keyframes for one shot.
- For cost control, start with 4s or 6s at 720p unless a hero shot needs more.

## Veo 3.1 Reference-To-Video

Model ID:

```text
fal-ai/veo3.1/reference-to-video
```

Best use:

- Shots where multiple reference images should influence subject appearance.
- Character/object/location consistency tests.
- Hero tests when we have a mature reference pack.

Input schema:

| Field | Required | Notes |
| --- | --- | --- |
| `prompt` | Yes | Describes the video to generate. |
| `image_urls` | Yes | List of reference images for consistent subject appearance. |
| `aspect_ratio` | No | `16:9`, `9:16`; default `16:9`. |
| `duration` | No | Default `8s`. |
| `resolution` | No | `720p`, `1080p`, `4k`; default `720p`. |
| `generate_audio` | No | Default `true`. |
| `auto_fix` | No | Optional prompt repair. |
| `safety_tolerance` | No | API-only, `1`-`6`, default `4`. |

Output:

| Field | Notes |
| --- | --- |
| `video.url` | Generated MP4 URL. |

Production notes:

- Use only after we have a clean reference pack.
- More expensive hero candidate; avoid for casual prompt exploration.

## Initial Routing Rules

| Shot Need | First Choice | Why |
| --- | --- | --- |
| Animate one approved keyframe | Seedance 2.5 I2V | Supports 4-30s, end frame optional, audio, 1080p. |
| Compare cheaper/4K Seedance path | Seedance 2.0 I2V | Allows 4K in schema and shorter max duration. |
| Start frame to exact end frame | Veo 3.1 first-last-frame | Endpoint is built for A-to-B control. |
| Multiple visual references | Veo 3.1 reference-to-video | Accepts multiple image URLs for subject appearance. |
| High-end hero shot | Test Seedance 2.5 vs Veo 3.1 vs Runway | Need empirical result on our own references. |

## Cost-Control Defaults

| Setting | Draft Default | Hero Default |
| --- | --- | --- |
| Duration | 4-5 seconds | 6-8 seconds, longer only if justified |
| Resolution | 720p | 1080p / 4K if needed |
| Audio | Off for pure visual tests unless no cost difference and useful | On only if evaluating audio |
| Bitrate | Standard | High |
| Batch size | 1 | 1 |
| Approval | Required before paid generation | Required every time |

## Open Questions

1. What are the exact current prices for each model in Ben's fal account?
2. Does fal expose reliable cost/usage data per request in result metrics?
3. Which endpoints allow free schema/status checks without generation?
4. Do uploaded local files need fal storage upload first, or can we pass hosted URLs from our environment?
5. Which models preserve face/uniform consistency best with our own approved reference frames?
