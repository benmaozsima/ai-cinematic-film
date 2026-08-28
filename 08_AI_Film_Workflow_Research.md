# AI Film Workflow Research

Date started: 2026-08-28

Purpose: collect research, case studies, model notes, and practical workflow lessons for producing a high-end cinematic AI short film with strong continuity.

## Research Standard

Each source is classified as:

- Academic / technical research: papers, lab pages, peer-reviewed venues, arXiv.
- Official tool documentation: model provider or API docs.
- Production case study: practical workflow report by creators/studios.
- Commentary / comparison: useful but lower confidence.
- Community anecdote: useful as a hint, not proof.

Each lesson must be translated into an actionable production rule before it affects our workflow.

## Current Working Thesis

High-end AI film production is not "one prompt to one movie." The strongest workflows combine:

1. pre-production bible,
2. reference images and character sheets,
3. image-to-video / first-last-frame control,
4. short clip generation,
5. model routing by shot type,
6. strong editing and sound design,
7. strict version tracking.

## Research Sources

| ID | Source | Type | Key Claim / Finding | Production Impact | Confidence |
| --- | --- | --- | --- | --- | --- |
| RES_001 | Consistent Character Video Generation via Content Anchors, arXiv, 2026 | Academic / technical research | Uses content anchors to improve identity and appearance consistency across long character videos. | Supports our rule: persistent character references and identity anchors must exist before generation. | High for principle, experimental for direct production use |
| RES_002 | ContextAnyone: Context-Aware Diffusion for Character-Consistent Text-to-Video, arXiv, 2025 | Academic / technical research | Character consistency requires more than face identity; hairstyle, outfit, and body shape are critical contextual cues. | Our Character Bible must include face, hair, body, outfit, silhouette, materials, and palette, not only a portrait. | High |
| RES_003 | I2V3D: Controllable Image-to-Video Generation with 3D Guidance, arXiv, 2025 | Academic / technical research | Combining coarse 3D geometry guidance with generative video improves control over camera movement, rotation, and animation. | For complex camera/vehicle shots, consider simple 3D previz or depth/pose guidance before video generation. | High for method direction |
| RES_004 | Controllable First-Frame-Guided Video Editing via Mask-Based Conditioning, arXiv, 2026 | Academic / technical research | First-frame guided video editing can preserve coherent motion and edited appearance when controlling an existing video. | First frame should be treated as a memory anchor; video-to-video/first-frame workflows are better than pure T2V for continuity. | Medium-high |
| RES_005 | IAMFlow: Advancing Narrative Long Video Generation via Identity-Aware Memory, arXiv, 2026 | Academic / technical research | Long narrative video benefits from explicit ID-centric memory banks for temporal consistency. | Our Production Bible and Shot Database are practical equivalents of an ID-centric memory bank. | High for principle |
| RES_006 | Semantic Frame Interpolation, arXiv, 2025 | Academic / technical research | First/last-frame interpolation with text control is valuable for generating intermediate video content. | Use first/last frame for shots where start and end composition are known. | High |
| RES_007 | AnimateAnything, CVPR 2025 | Academic / technical research | I2V improves when dynamic control signals such as motion annotations and camera trajectories are supplied. | Our prompts should separate subject motion, camera motion, and environmental motion. | High |
| RES_008 | Frame In-N-Out, UVA Computer Vision Lab | Academic / technical research | Controlling objects entering/exiting frame improves temporal coherence and cinematic controllability. | Plan frame entrances/exits deliberately as edit points and shot transitions. | Medium-high |
| RES_009 | Runway Gen-4 world consistency announcement | Official tool documentation / provider research | Runway claims consistent characters, objects, locations, and styles across scenes using visual references and instructions without fine-tuning. | Good candidate for character/location hero tests, especially with approved references. | Medium-high, provider claim |
| RES_010 | Runway Gen-4.5 announcement | Official tool documentation / provider research | Runway claims improved motion quality, prompt adherence, temporal consistency, and controllability. | Candidate for hero cinematic shots and difficult character/object motion. | Medium-high, provider claim |
| RES_011 | Google Veo 3.1 Gemini API docs | Official tool documentation | Veo 3.1 supports native audio, video extension, frame-specific generation, and image-based direction. | Candidate for hero shots, audio-connected shots, extensions, and first/last-frame tests. | High for capability, quality to test |
| RES_012 | fal video generation docs | Official API documentation | fal exposes video generation models through a unified API, supporting text-to-video, image-to-video, and video-to-video workflows. | Fal is a good first integration layer for model testing without building separate provider clients. | High |
| RES_013 | fal Seedance 2.5 image-to-video docs | Official API documentation | Seedance 2.5 on fal can animate still images into longer cinematic video with native audio and director-level camera control. | Strong candidate for our first reference-frame-to-video tests. Must control cost and verify actual output. | Medium-high |
| RES_014 | NeoLemon character consistency guide, 2026 | Production workflow guide | Do not ask a video model to invent and animate a character simultaneously; lock identity first, then animate. | Core workflow rule for every important character. | Medium |
| RES_015 | Kittl AI video character consistency workflow, 2026 | Production workflow guide | Consistency needs clear reference image, locked style, controlled motion, stable lighting, and defined first/end frames. | Matches our design-first workflow; use as practical checklist. | Medium |
| RES_016 | ChatCut 2026 model comparison | Commentary / comparison | Many teams use more than one model: Seedance for bulk/story continuity, Runway or Veo for hero shots. | We should route shots by type and cost tier instead of choosing one model. | Medium |
| RES_017 | Storyflow short-film production tools guide, 2026 | Production workflow guide | Short films are won or lost in pre-production: script, mood board, storyboard, shot list, schedule. | Reinforces that we should not generate final clips before bible/storyboard/shot list. | Medium |
| RES_018 | Tribeca 2026 generative AI film coverage, The Verge | Industry reporting | Stronger AI film work used tailored workflows, concept art, and traditional tools; generic generation alone remained inconsistent. | Our film should use a hybrid directed workflow, not raw prompting. | Medium-high |
| RES_019 | Amazon MGM AI Studio report, Reuters, 2026 | Industry reporting | Studio AI workflows focus on reducing costs, character consistency, standard creative tool integration, and human-guided production. | Confirms industry direction: AI as production support with director control. | Medium-high |
| RES_020 | Wired Hollywood AI article, 2025 | Industry reporting | AI is useful in previz, but feature-quality work still struggles with 4K, repeatability, and controllability. | Do not assume generation outputs are final; plan upscaling, QC, and human edit decisions. | Medium-high |

## Practical Lessons Extracted

| Lesson ID | Lesson | Our Production Rule |
| --- | --- | --- |
| LESSON_RESEARCH_001 | Character consistency is identity plus context, not just face. | Character sheets must define face, hair, body, outfit, silhouette, materials, palette, age, posture, and lighting behavior. |
| LESSON_RESEARCH_002 | First frames act as memory anchors for video models. | Important shots should begin from approved keyframes, not text-only prompts. |
| LESSON_RESEARCH_003 | First/last-frame workflows are best when the dramatic beat has a known endpoint. | Use first/last frames for reveals, turns, impacts, entrances, exits, and transitions. |
| LESSON_RESEARCH_004 | Long-form consistency requires an ID-centric memory system. | Use persistent IDs in Production Bible and Shot Database for every reusable asset. |
| LESSON_RESEARCH_005 | Camera, subject, and environment motion should be specified separately. | Shot prompts must include separate `camera`, `subject_action`, and `environment_motion` fields. |
| LESSON_RESEARCH_006 | High-end AI films rely on editing and audio as much as generation. | Every shot must include planned edit point, transition logic, ambience, SFX, and music cue. |
| LESSON_RESEARCH_007 | Model routing beats model loyalty. | Choose model per shot: cheap tests, consistency shots, first-last-frame shots, hero shots. |
| LESSON_RESEARCH_008 | Industry workflows still require QC and post-production. | Treat generated clips as raw footage; review, reject, regenerate, upscale, grade, and master. |

## Current Model Hypothesis For Our Pipeline

| Shot Need | First Test Choice | Backup / Hero Choice | Reason |
| --- | --- | --- | --- |
| Reference image to cinematic motion | Seedance 2.5 via fal | Runway Gen-4.5 | Seedance looks strong for cinematic I2V and native audio; Runway strong for visual consistency. |
| First/last-frame controlled beat | Veo 3.1 first-last-frame via fal | Kling 3 first/end frame | Endpoint control is more important than broad creativity. |
| Character performance close-up | Runway Act-Two if available | Seedance/Veo I2V from approved keyframe | Performance transfer may solve expression/body acting better than prompting. |
| Battlefield / crowd / environmental scale | Seedance / Veo | Kling / Runway | Large scale can tolerate less exact identity if palette and atmosphere are locked. |
| Cheap motion exploration | Fal lower-cost tiers | Replicate lower-cost tiers | Explore motion before paying for hero generations. |

## Open Questions

1. Which models on fal are actually available to Ben's account and at what price?
2. Can fal expose reliable cost estimates before job submission for every model?
3. Does Seedance 2.5 on fal support the exact reference controls we need: multiple images, first/last frame, audio, motion style, fixed camera?
4. Which model gives the best identity consistency from our own generated character sheets?
5. Should our original film avoid human close-ups early, or embrace them and solve consistency rigorously?
6. What minimum resolution and upscaling path will pass our final quality target?

## Immediate Next Research Tasks

1. Inspect fal model schemas for Seedance 2.5, Veo 3.1, Kling 3, and Runway Gen-4.5.
2. Build a cost-controlled dry-run planner before any paid generation.
3. Create a test matrix: same keyframe across 3 models, same duration, same prompt, same evaluation rubric.
4. Continue searching creator case studies for actual prompt/settings screenshots and failed-generation lessons.

## Research Pass 003 - Fal Schema Findings

Detailed notes are stored in `09_Fal_Model_Schema_Notes.md`.

Early conclusion:

- Seedance 2.5 image-to-video is a strong first candidate for approved-keyframe animation.
- Veo 3.1 first/last-frame is the clearest candidate for A-to-B cinematic control.
- Veo 3.1 reference-to-video is useful only after we have a proper reference pack.
- Paid Fal calls must be blocked behind explicit approval.
