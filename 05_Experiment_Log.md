# Experiment Log

Use this file for every generation or post-production test. Failed tests are valuable and should remain recorded.

## Experiment Template

| Test ID | Date | Goal | Asset IDs | Model/Tool | Prompt | References | Settings | Result | Problems | Improvement | Status | Version |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| TEST_001 | 2026-09-01 | Create the first valid Shoko A identity/wardrobe reference sheet | CHAR_001, PROP_001, PROP_002 | OpenAI built-in `image_gen` (internal model ID not exposed) | Exact prompt published in `dashboard/index.html` beside the asset | No input images; repository canon only | One 1024×1536 RGB PNG; $0 incremental API cost | `assets/characters/CHAR_001_reference_sheet_v0.2.png`; SHA-256 `65930d7ce3c9874fd57fb681eda6bc3d4ee8159ac063bd494eb550bdb37847f6` | Awaiting identity/wardrobe review; built-in tool does not expose an internal model ID | Approve, revise or reject before any further character generation | REVIEW | v0.2 |

## Evaluation Criteria

| Criterion | Question |
| --- | --- |
| Continuity | Does the shot preserve approved designs and spatial logic? |
| Cinematic value | Does it feel directed, composed, and motivated? |
| Motion quality | Are physics, body movement, camera motion, and timing believable? |
| Prompt adherence | Did the model follow the actual shot brief? |
| Editability | Can this clip cut with surrounding shots? |
| Audio fit | Does sound reinforce scale, emotion, and rhythm? |
| Artifact severity | Are errors ignorable, fixable, or fatal? |

## Lessons Learned

| Lesson ID | Date | Finding | Applies To | Evidence |
| --- | --- | --- | --- | --- |
| LESSON_001 | TBD | TBD | TBD | TBD |
