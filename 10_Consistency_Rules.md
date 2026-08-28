# Consistency Rules

Date started: 2026-08-28

Purpose: define how we preserve a single cinematic identity even when using multiple AI video models.

## Core Rule

The model does not hold the film together. The production system does.

```text
Production Bible
-> approved references
-> approved keyframes
-> controlled model routing
-> strict review
-> unified edit, sound, and grade
```

## Rule 1 - One Master Visual Bible

Every generation must inherit `STYLE_001`.

`STYLE_001` must define:

- color palette,
- lighting rules,
- camera/lens language,
- contrast and saturation,
- texture and grain,
- weather and atmosphere,
- skin, fabric, metal, glass, and dirt behavior,
- forbidden looks.

No shot can be approved if it feels like a different film, even if it looks impressive.

## Rule 2 - References Before Video

Important assets must be approved as references before video generation:

- character front / profile / 3-quarter,
- costume and silhouette,
- location wide / medium / detail,
- hero props and vehicles,
- key lighting references,
- style reference frame.

The prompt must not ask the video model to invent core designs from scratch.

## Rule 3 - Keyframes Are Memory Anchors

Important shots should start from approved keyframes.

For precise actions, use:

```text
approved first frame + approved last frame + motion prompt
```

Use first/last-frame workflows for:

- reveals,
- turns,
- entrances and exits,
- impacts,
- object handoffs,
- camera landings,
- transitions.

## Rule 4 - Model Zoning

Do not mix models randomly.

Preferred zoning:

| Zone | Rule |
| --- | --- |
| Main character close-ups | Keep one preferred model unless another clearly wins. |
| Hero action shots | Use the best model for that shot, then grade tightly. |
| Vehicles / objects | Use consistent references and preferably one model family. |
| Atmosphere / inserts | Cheaper or different models allowed if style matches. |
| First-last-frame transitions | Use models specialized in endpoint control. |

## Rule 5 - Same Prompt Blocks

Each shot prompt should reuse stable blocks:

- `STYLE_BLOCK`,
- `CHARACTER_BLOCK`,
- `LOCATION_BLOCK`,
- `CAMERA_BLOCK`,
- `NEGATIVE_BLOCK`,
- `CONTINUITY_BLOCK`.

Only the shot action should change heavily.

## Rule 6 - Sound Is Continuity

Sound design must be planned as part of the shot.

Recurring sound anchors:

- room tone / location ambience,
- radio filter,
- footsteps and clothing movement,
- engines and mechanical sounds,
- impact/explosion style,
- music motif,
- reverb space.

Audio can make separately generated clips feel like one continuous scene.

## Rule 7 - Editing Language Is Continuity

Use motivated cut points:

- eyeline,
- movement direction,
- object movement,
- doorway or frame wipe,
- flash,
- smoke,
- impact,
- radio call,
- breath or reaction.

Do not rely on long AI clips when a 3-5 second directed shot will be cleaner.

## Rule 8 - Final Grade Unifies Sources

All accepted shots go through a shared finishing look:

- contrast curve,
- black level,
- highlight rolloff,
- saturation limit,
- grain,
- sharpening/softening,
- halation/glow where appropriate,
- final aspect ratio and crop.

The grade is not cosmetic; it is a continuity tool.

## Rule 9 - Rejection Beats Repair

A beautiful shot is rejected if it breaks approved continuity.

Reject or regenerate when:

- face identity drifts,
- costume changes without story reason,
- location geometry contradicts approved geography,
- colors leave the palette,
- camera language feels unrelated,
- scale is wrong,
- symbols/text appear accidentally,
- motion physics distracts,
- the shot cannot cut with neighboring shots.

## Rule 10 - Every Lesson Becomes A Rule Or A Test

If we learn something from a reference film, creator workflow, research paper, or failed generation, it must become either:

- a production rule,
- a test hypothesis,
- a model-routing rule,
- or a rejection criterion.

Nothing important stays only in chat.
