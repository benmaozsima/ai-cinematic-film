# Project Index

## Project Status

Phase: Original short pre-production - 60-second screenplay and shot lock

Current focus: produce the approved 60-second Israeli comedy `The Search Party` from locked references, beginning with screenplay, shot-list and dry-run preparation. Reference-film research remains preserved as methodology work.

## Standing Decisions

| ID | Decision | Status | Notes |
| --- | --- | --- | --- |
| DEC_001 | Use Red Alert 2 AI cinematic only as a methodology reference, not as creative source material | Approved | No copying plot, characters, locations, vehicles, dialogue, or distinctive designs. |
| DEC_002 | Preserve confirmed / inferred / speculative labels in all research | Approved | Required before tool or workflow conclusions. |
| DEC_003 | Prioritize reusable references and image-to-video/keyframe workflows for continuity | Working assumption | To be validated during Phase 1. |
| DEC_004 | Develop `The Search Party` as an Israeli comedy | Approved | This is the active creative direction; preserve the serious `The Visitor in the Green House` materials as a prior branch. |
| DEC_005 | Target a 60-second finished runtime | Approved | Existing 60-90 second and 5-7 minute drafts require a new 60-second conform before shot approval. |
| DEC_006 | Keep Shoko and the search-party characters male | Approved | Do not use the rejected female `CHAR_003` experiment; assign every recurring man a distinct persistent character ID. |
| DEC_007 | Make the structural homage to `Adon Shoko` clear | Approved | Preserve an original story, dialogue, music, staging and visual execution; do not use the song lyrics, melody or recording. |
| DEC_008 | Approve the after-party reveal as the final story | Approved | The search party totals four male Shokos, and they find a fifth Shoko hosting an after-party after leaving his phone on silent. |
| DEC_009 | Approve the five-man principal cast and existing Shoko A direction | Approved | All principals are named Shoko on screen. `CHAR_001` / Shoko A is the approved protagonist direction. |
| DEC_010 | Begin pre-production, not paid generation | Approved | Prepare the 60-second screenplay, shots, references and costed dry run. Fal execution still requires a separate explicit approval after the exact cost is shown. |
| DEC_011 | Publish the production dashboard publicly without authentication | Approved | The dashboard is not sensitive; prioritize the simplest internet access. This does not change the separate Fal/payment approval gate. |
| DEC_012 | Name every principal man Shoko on screen | Approved | Preserve distinct `CHAR_###` IDs and internal Shoko A-E labels for production continuity. Yossi, Moti and Avi are superseded active labels. |

## Phase Deliverables

| Phase | Deliverable | Status |
| --- | --- | --- |
| Phase 1 | Source inventory and attribution research | Started |
| Phase 1 | Shot-by-shot reference film breakdown | Started from uploaded 2:11 screen recording |
| Phase 1 | Visual consistency analysis | Started from uploaded 2:11 screen recording |
| Phase 1 | AI tool/method inference report | Started |
| Phase 1 | 2026 tool map for reproducing techniques | Planned |
| Phase 1 | Reusable AI film production pipeline | Drafted in `14_AI_Film_Production_Pipeline_v1.md` |
| Phase 1 | Fal dry-run/cost-control runner | Created and verified dry-run only |
| Pre-production | 60-second canonical screenplay | Created in `32_Short_Film_Screenplay_v0.3_60s.md` |
| Pre-production | 60-second canonical shot list | Created in `33_Shot_List_v0.2_60s.md` |
| Pre-production | Character and group direction | Approved; supporting individual close-up references still incomplete |
| Pre-production | Visual Review Pack 001 | One-page schematic storyboard ready; 18 legacy raster references require source recovery before detailed visual approval |
| Pre-production | Opening visual pass A | S001-S004 schematic shot cards with dialogue and sound ready in `assets/review/OPENING_PREVIS_v0.1.png` |
| Pre-production | Friends-join visual pass B | S005-S008 schematic shot cards with dialogue, props and sound ready in `assets/review/JOINING_PREVIS_v0.1.png` |
| Pre-production | March-to-door visual pass C | S009-S012 schematic shot cards with formation, dialogue and suspense sound ready in `assets/review/MARCH_PREVIS_v0.1.png` |
| Pre-production | Production dashboard v0.3 | S001-S012 schematic review passes visible; public deployment workflow exists; real model-input stills remain missing |
| Pre-production | Codex handoff | Current continuation brief and next-agent prompt in `35_CODEX_HANDOFF.md` |
| Pre-production | CHAR_001 / Shoko A reference v0.2 | Valid 1024×1536 RGB PNG generated and published to the dashboard; status `REVIEW` pending Ben's decision |
| Production | Paid video generation | Blocked pending cost estimate and separate explicit approval |

## Persistent ID Registry

Original-film IDs must not be assigned until Phase 3 begins.

Reserved namespaces:

| Namespace | Use |
| --- | --- |
| STYLE_### | Master visual style and substyles |
| CHAR_### | Characters |
| LOC_### | Locations |
| VEH_### | Vehicles |
| PROP_### | Props |
| SCENE_### | Scenes |
| SHOT_### | Shots |
| REF_### | Reference images or clips |
| TEST_### | Generation experiments |
| DEC_### | Decisions |

## Immediate Needs From Ben

1. The highest-quality downloadable copy of the reference film, ideally the original Douyin upload or a clean repost with no heavy compression.
2. Any links you already have: Instagram reel, Douyin page, YouTube repost, Bilibili repost, Reddit thread, creator profile.
3. Permission to use frame extraction from the reference video for analysis only.
4. Whether you want the analysis language to be English, Hebrew, or bilingual.
5. Whether we should target our final production workflow for tools you personally can access, or for the best available tools even if some are external/paid.

## Received Materials

| ID | Date | Material | Local File | Notes |
| --- | --- | --- | --- | --- |
| MAT_001 | 2026-08-28 | iPhone screen recording of Instagram repost | `/workspace/scratch/7650aa1ac0e4/upload/ScreenRecording_08-28-2026 20-51-06_1.mp4` | 2:11 vertical screen recording, 512x1112, 30fps, includes Instagram UI overlay and audio. Good enough for initial shot/method analysis, not final archival source. |
## Audio and speech continuity

`36_Audio_LipSync_Contract_v0.1.md` is the canonical contract for dialogue visibility, Hebrew voice assets, timing and lip-sync. A line in metadata is not a speaking face: `visible_speaker` shots require a dedicated audio-driven lip-sync pass, while silent/offscreen shots may use post-production audio. The dashboard mirrors this gate for review.

`37_Transition_Continuity_Contract_v0.1.md` is the canonical handoff map. It makes incoming/outgoing pose, prop, eyeline, screen direction, lighting, audio bridge and transition device explicit so generation carries continuity and editing remains minimal.

`38_AI_Video_QC_and_Prompting_Contract_v0.1.md` is the canonical frame-level quality-control and repair-prompt contract. It was added after S003 phone-face ambiguity and S005 threshold-crossing failures; it requires dense temporal review, not first-frame review alone.
