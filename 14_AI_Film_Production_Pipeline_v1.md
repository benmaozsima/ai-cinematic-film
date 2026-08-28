# AI Film Production Pipeline v1

Date: 2026-08-28

Purpose: define the working production pipeline for creating a high-end original AI cinematic short film.

Target: 5-8 minute original cinematic short that feels intentionally directed, visually consistent, emotionally coherent, and professionally edited.

## Core Principle

Consistency before spectacle.

No generated shot is valuable unless it belongs to the same film.

## Phase A - Research And Method Extraction

Status: In progress.

Inputs:

- reference films,
- creator workflows,
- technical research papers,
- model documentation,
- our own experiments.

Outputs:

- production lessons,
- consistency rules,
- model-routing rules,
- rejected/failure patterns,
- cost controls.

Current sources:

- Red Alert reference clip analysis,
- creator workflow case studies,
- Fal / Seedance / Veo schema research,
- technical consistency/control research.

Exit criteria:

- We can explain how to preserve visual continuity across shots.
- We have a cost-controlled testing workflow.
- We know which model families to test for each shot type.

## Phase B - Original Concept Development

Do not copy reference creative content.

Outputs:

- logline,
- genre,
- emotional core,
- theme,
- world premise,
- target runtime,
- audience feeling,
- creative constraints.

Decision gate:

- Approve one concept before worldbuilding.

## Phase C - World And Visual Identity

Outputs:

- `STYLE_001` master look,
- color palette,
- lighting rules,
- lens/camera language,
- atmosphere rules,
- texture/material rules,
- forbidden looks,
- visual references.

Decision gate:

- Approve `STYLE_001` before character/location finalization.

## Phase D - Character Design

For every major character:

- persistent ID,
- role,
- face,
- hair,
- body shape,
- posture,
- costume,
- silhouette,
- palette,
- emotional range,
- continuity constraints,
- reference pack.

Minimum reference pack:

- front portrait,
- 3/4 portrait,
- profile,
- full-body costume,
- expression sheet if dialogue-heavy.

Decision gate:

- Character is not video-ready until reference pack is approved.

## Phase E - Location / Object / Vehicle Design

For every reusable location/object/vehicle:

- persistent ID,
- silhouette,
- scale,
- materials,
- color,
- aging/wear,
- lighting behavior,
- camera-friendly angles,
- reference pack.

Decision gate:

- Reusable assets are not shot-ready until approved.

## Phase F - Screenplay And Scene Breakdown

Outputs:

- screenplay,
- scene list,
- scene purpose,
- emotional beat map,
- dialogue/radio/voice strategy,
- visual set pieces,
- continuity dependencies.

Rule:

- Write scenes for AI-producible cinematic coverage, not impossible continuous action.

Preferred scene grammar:

```text
small signal
-> human reaction
-> reveal
-> consequence
-> decision
```

## Phase G - Storyboard And Keyframes

Outputs:

- storyboard panels,
- approved keyframes,
- first/last frames where needed,
- edit transitions,
- sound intention per beat.

Rule:

- Important shots start from approved keyframes.

Use first/last frames for:

- reveals,
- impacts,
- entrances/exits,
- turns,
- handoffs,
- camera landings,
- major transitions.

## Phase H - Shot Database

Every shot must include:

- `SCENE_ID`,
- `SHOT_ID`,
- purpose,
- duration,
- camera,
- action,
- characters,
- location,
- references,
- generation model,
- prompt,
- negative/constraints,
- audio,
- status,
- version,
- notes.

Statuses:

```text
IDEA -> DESIGNED -> READY -> GENERATED -> REVIEW -> APPROVED -> FINAL
```

No paid generation unless status is `READY` and Ben approves.

## Phase I - Model Routing

Choose model by shot requirement.

| Shot Need | Preferred Route |
| --- | --- |
| Cheap motion/composition test | Low-cost draft via Fal aggregator |
| Approved keyframe to cinematic motion | Seedance 2.5 image-to-video |
| Known first and last frame | Veo 3.1 first/last-frame or Kling equivalent |
| Multiple reference images for subject consistency | Veo 3.1 reference-to-video or Runway references |
| Hero cinematic realism | Compare Seedance 2.5, Veo 3.1, Runway Gen-4.5 |
| Character performance / acting | Runway Act-Two or equivalent performance-transfer workflow |
| Atmosphere inserts | Cheaper model allowed if style/grade match |

Rule:

- Use model zoning. Do not randomly switch models for the same character/location zone.

## Phase J - Prompt Construction

Every prompt should use modular blocks:

- `STYLE_BLOCK`,
- `CHARACTER_BLOCK`,
- `LOCATION_BLOCK`,
- `CAMERA_BLOCK`,
- `ACTION_BLOCK`,
- `CONTINUITY_BLOCK`,
- `AUDIO_BLOCK`,
- `NEGATIVE_BLOCK`.

Prompt must separate:

- subject action,
- camera movement,
- environmental motion,
- emotional beat,
- edit point.

## Phase K - Cost-Controlled Generation

Default flow:

```text
dry-run payload
-> local validation
-> cost estimate
-> Ben approval
-> one generation
-> review
-> decide next action
```

Rules:

- No blind batches.
- No paid generation without explicit approval.
- Drafts default to 4-5 seconds, 720p.
- Hero generations require strong reason and approved references.
- Upscaling only approved shots.

## Phase L - Review And QC

Review every result against:

- character identity,
- costume continuity,
- location continuity,
- palette,
- lighting,
- camera language,
- motion realism,
- artifact severity,
- editability,
- sound fit,
- emotional purpose.

Verdicts:

| Verdict | Meaning |
| --- | --- |
| Reject | Do not use; problem too large. |
| Retry | Same method with prompt/reference/settings fix. |
| Alt Model | Try different model route. |
| Edit Save | Usable with crop/edit/color/sound. |
| Approve | Enters edit candidate pool. |

## Phase M - Editing

Editing is not cleanup. It is part of direction.

Preferred transition devices:

- eyeline,
- motion continuation,
- flash,
- smoke,
- doorway/frame wipe,
- radio call,
- impact,
- breath/reaction.

Default shot duration:

- 3-6 seconds for action/story progression.
- Longer only when motion/performance quality holds.

## Phase N - Sound And Music

Sound must be planned before final edit.

Layers:

- dialogue,
- voice-over/radio,
- ambience,
- SFX,
- Foley,
- music,
- transitions,
- silence.

Rule:

- Sound design is a continuity system.

## Phase O - Color, Upscale, Master

Only approved shots enter finishing.

Finishing steps:

- crop/aspect conform,
- stabilization if needed,
- denoise/sharpen,
- upscale if needed,
- color grade,
- grain/texture,
- final mix,
- subtitles,
- export masters.

Master checks:

- visual consistency,
- audio levels,
- subtitle timing,
- artifact scan,
- story clarity,
- runtime,
- delivery format.

## First Practical Test Plan

No paid video yet.

1. Select one original micro-scene once Phase 3 begins.
2. Generate one still keyframe.
3. Build three dry-run payloads:
   - Seedance 2.5 I2V,
   - Veo 3.1 first/last-frame,
   - Veo 3.1 reference-to-video.
4. Estimate cost.
5. Ask Ben for approval before one paid generation.
6. Review result and update Experiment Log.

## Current Project Position

We are not ready to invent the full film yet.

Next immediate work:

1. Finish technical consistency/control research.
2. Build Fal dry-run/cost-control runner.
3. Then begin original concept development.
