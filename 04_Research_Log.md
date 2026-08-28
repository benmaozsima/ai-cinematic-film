# Research Log

## Evidence Classification

- Confirmed: primary source, direct creator statement, or direct frame/audio evidence.
- Strong inference: repeated credible secondary reports or highly visible evidence.
- Speculation: plausible but not verified.

## Source Inventory

| ID | Date Added | Source | URL | Type | Relevant Claim | Classification | Notes |
| --- | --- | --- | --- | --- | --- | --- | --- |
| SRC_001 | 2026-08-28 | Instagram repost | https://www.instagram.com/reel/DclU3agAOfF/ | Repost | Credits "Lyxw1327 on Douyin" and describes solo AI Red Alert 2 cinematic. | Strong inference | User-provided link; not primary source. |
| SRC_002 | 2026-08-28 | LinkedIn repost/search result | https://www.linkedin.com/posts/evolving-ai_a-chinese-creator-just-turned-red-alert-2-activity-7496602064228302848-Sgiz | Repost/commentary | Calls creator lyxw1327 and describes one-person AI film. | Strong inference | Secondary source, useful but not proof of workflow. |
| SRC_003 | 2026-08-28 | Reddit r/redalert2 discussion | https://www.reddit.com/r/redalert2/comments/1vti7oj/red_alert_2_ai_short_22_minutes/ | Community discussion | Refers to the film as "22 Minutes" and discusses dialogue/plot. | Strong inference | Needs comparison against source upload. |
| SRC_004 | 2026-08-28 | Reddit r/aivideo discussion | https://www.reddit.com/r/aivideo/comments/1vuc863/red_alert/ | Community discussion | Audience reactions and comments on pacing/editing/sound. | Strong inference | Useful for reception, not workflow proof. |
| SRC_005 | 2026-08-28 | Uploaded iPhone screen recording | `/workspace/scratch/7650aa1ac0e4/upload/ScreenRecording_08-28-2026 20-51-06_1.mp4` | User-provided analysis material | 2:11 excerpt/repost with visible video, subtitles, and audio. | Confirmed | Direct frame/audio evidence for initial shot analysis, but not original source quality. |

## Analysis Artifacts

| ID | Date | Artifact | Path | Purpose |
| --- | --- | --- | --- | --- |
| ART_001 | 2026-08-28 | 5-second full-screen contact sheet | `/workspace/scratch/7650aa1ac0e4/analysis_frames/contact_sheet_5s.jpg` | Fast overview including Instagram UI. |
| ART_002 | 2026-08-28 | 1-second cropped contact sheet | `/workspace/scratch/7650aa1ac0e4/analysis_frames/crop_contact_1s.jpg` | Main visual basis for initial shot grouping. |
| ART_003 | 2026-08-28 | Final segment cropped contact sheet | `/workspace/scratch/7650aa1ac0e4/analysis_frames/crop_contact_100_131.jpg` | Closer view of 01:40-02:11 segment. |

## Creator / Production Process Research Targets

| Target | Why It Matters | Status |
| --- | --- | --- |
| Original Douyin profile for lyxw1327 | Primary attribution and possible workflow posts | Open |
| Original Douyin video URL | Best source for upload date, caption, comments, quality | Open |
| Chinese-language title and hashtags | Helps find reposts/interviews/BTS | Open |
| Creator workflow notes | Only path to confirmed tool usage | Open |
| Making-of clips or comments | May reveal image references, keyframes, edits, or model choices | Open |
| Repost chain | Prevents mistaking a repost caption for creator claim | Open |

## Tool Research Targets For 2026

| Production Need | Candidate Tools To Research | Notes |
| --- | --- | --- |
| Cinematic video generation | Sora, Veo, Kling, Seedance, Runway, Luma, Pika | Compare continuity, camera control, realism, prompt adherence. |
| Reference image generation | Midjourney, GPT image generation, Flux variants, Ideogram, Firefly | Character sheets, vehicles, environments, style bible. |
| Character consistency | Reference image workflows, LoRA/fine-tuning where available, face reference tools | Must avoid identity drift. |
| Keyframe / first-last-frame control | Kling, Runway, Luma, Seedance, other I2V tools | Critical for continuity and edit planning. |
| Lip sync / performance | HeyGen, ElevenLabs, Runway, Hedra, Sync/LipDub tools | Research current quality and licensing. |
| Voice | ElevenLabs, OpenAI voice, PlayHT, Resemble, Murf | Match language, acting range, rights. |
| Music | Suno, Udio, Stable Audio, licensed libraries | Need copyright-safe soundtrack path. |
| Sound design | Soundly, ElevenLabs SFX, stock libraries, Foley workflows | War/vehicle/ambient consistency. |
| Editing/mastering | DaVinci Resolve, Premiere, CapCut, Topaz, ffmpeg | Color, upscaling, conform, subtitles, deliverables. |

## Research Pass 002 - AI Film Workflow And Technical Consistency

| Finding | Classification | Source |
| --- | --- | --- |
| Character consistency requires identity plus context: face, hair, body, outfit, and broader visual cues. | Strong inference from technical research | ContextAnyone; Consistent Character Video Generation via Content Anchors |
| Image-to-video and first-frame workflows are central for consistency because the first frame acts as a visual anchor/memory. | Strong inference from technical research | DreamVideo; first-frame guided editing papers; Semantic Frame Interpolation |
| More controllable video requires separating camera control, object/subject motion, and environment motion. | Strong inference from technical research | I2V3D; AnimateAnything; Frame Guidance |
| Long narrative video needs an explicit memory or ID system. | Strong inference from technical research | IAMFlow and related long-video consistency research |
| Production workflows should use multiple models routed by shot type instead of forcing one model for all shots. | Strong inference from production comparisons | ChatCut, Pixflow, fal/Replicate model availability |
| Generic prompting alone is not enough for high-end AI cinema; stronger results come from reference art, tailored workflows, and traditional post-production. | Strong inference from industry reporting | Tribeca 2026 reporting; Reuters Amazon MGM AI Studio report; Wired Hollywood AI article |

Detailed notes are stored in `08_AI_Film_Workflow_Research.md`.
