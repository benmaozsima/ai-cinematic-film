# Audio, Dialogue & Lip-Sync Contract v0.1

Date: 2026-09-01  
Status: canonical production infrastructure decision  
Scope: `The Search Party` and future AI-film projects using this workspace

## The rule we were missing

Writing dialogue in a screenplay, shot card or HTML review panel does **not** make a character speak on camera. A generated video can contain a silent face while the dialogue exists only as metadata. Every shot must therefore declare whether speech is visible and how its audio will be supplied before it can be marked ready.

Hebrew dialogue remains exact, selectable HTML text beside the media. It is never rendered by an image or video model as text inside the frame.

## Required shot fields

Every future shot pack must include:

| Field | Allowed values / meaning |
| --- | --- |
| `dialogue_visibility` | `none`, `offscreen`, or `visible_speaker` |
| `audio_mode` | `silent_visual`, `post_production`, `native_audio_video`, or `external_voice_lipsync` |
| `lip_sync_required` | Boolean. Must be `true` whenever a visible speaker is expected to form words. |
| `voice_asset_id` | Versioned approved WAV/AIFF asset, or `null` while not recorded. |
| `transcript_hebrew` | Exact canonical Hebrew line(s), including speaker and punctuation. |
| `timing_asset` | Word/phoneme timing JSON or `null` until prepared. |
| `speaker_id` | Persistent voice identity, or `null` for no speech. |
| `pronunciation_notes` | Names, pauses, emphasis and Hebrew pronunciation constraints. |

Validation must reject `dialogue_visibility: visible_speaker` unless `lip_sync_required` is true and both an approved voice asset and timing plan exist.

## Routing decision

| Shot need | Default route | Why |
| --- | --- | --- |
| No speech, purely visual | `silent_visual` | Generate motion only; add ambience/SFX/music in post. |
| Dialogue is voice-over or the speaker is off camera | `post_production` | Record exact Hebrew separately; no mouth animation is promised. |
| Speaker visibly talks in frame | `external_voice_lipsync` | Lock the visual first, then drive the mouth from the approved Hebrew recording. |
| Model-native audio experiment | `native_audio_video` | Allowed only as a labelled comparison; pronunciation and mouth timing still require QC. |

For this project the preferred speaking path is: approved visual clip → approved Hebrew voice recording → dedicated audio-driven lip-sync pass → dialogue/ambience/Foley/SFX mix → music last → QC. This keeps character continuity independent from language, makes redubbing possible, and avoids asking a visual model to invent exact Hebrew. Early tests stay free of background music so dialogue intelligibility and performance can be judged honestly.

## Provider/model policy

Fal Seedance 1.5/2.5 may generate native audio, but native audio is experimental for exact Hebrew and is not an automatic lip-sync guarantee. For a visible speaker, the preferred dedicated route is an audio-to-video lip-sync model such as [Fal Kling LipSync audio-to-video](https://fal.ai/models/fal-ai/kling-video/lipsync/audio-to-video), subject to a fresh model/price check and explicit approval before each paid operation. A 4-second clip is currently listed as billed in a 5-second minimum block; the exact estimate must be recorded in the payload immediately before execution.

No provider is permanently hard-coded. The contract records the exact provider, model, version, cost estimate, input URLs/IDs, output URL, output hash and QC result for each pass.

## Current Search Party decisions

- `S001`: `dialogue_visibility=none`, `audio_mode=silent_visual`; no lip-sync expected.
- `S002`: `dialogue_visibility=none`, `audio_mode=silent_visual`; no lip-sync expected.
- `S003`: the canonical line is an offscreen/post-production line while Shoko checks the phone; `audio_mode=post_production`, `lip_sync_required=false` for the current visual pass.
- `S005`, `S006`, `S010`, `S014` and any later shot with a clearly visible speaker: blocked until the voice asset, timing plan and dedicated lip-sync route are approved.

## Review and storage

The dashboard must show the exact Hebrew transcript, visibility mode, audio mode, voice asset/version, provider/model, cost gate and lip-sync QC status. Generated audio and video remain outside Git under ignored `outputs/` or approved object storage; manifests, hashes, prompts and review decisions stay in Git. A rejected lip-sync pass is preserved as history and never silently replaces an approved version.

## Lessons carried forward

1. Dialogue metadata is not speech animation.
2. A beautiful silent visual is still valid when the line is explicitly offscreen or added in post.
3. A visible speaking face requires a dedicated mouth-sync deliverable, not subtitles alone.
4. Separate voice and video assets make future films, language changes and redubs safer.

## Reusable voice-bible template

For every recurring character, store a versioned record with: \`speaker_id\`, character ID, performer or voice-model provider, voice asset SHA-256, language, vocal age, pitch/range, speech rate, emotional baseline, pronunciation exceptions, consent/rights status and replacement/redub notes. A voice may not be silently reassigned between shots.
