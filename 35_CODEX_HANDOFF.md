# Codex Handoff — The Search Party

Status: S001–S003 video review in progress; audio/lip-sync contract locked
Date: 2026-08-31  
Branch: `work`  
Repository: `benmaozsima/ai-cinematic-film`

## Read this first

The repository is the single source of truth. Before changing anything, read:

1. `README.md`
2. `00_Project_Index.md`
3. `02_Production_Bible.md`
4. `32_Short_Film_Screenplay_v0.3_60s.md`
5. `33_Shot_List_v0.2_60s.md`
6. `34_Visual_Review_Pack_001.md`
7. this handoff

Preserve all persistent IDs, approved decisions, versions, rejected experiments and continuity rules. Do not silently reinterpret `DESIGNED` or `REVIEW` as `APPROVED`.

## Active canonical film

- Title: **The Search Party** / **מסיבת החיפוש**.
- Form: original Israeli comedy.
- Runtime: exactly **60 seconds**.
- Master: **9:16, 1080×1920, phone-first**.
- Structure: one Shoko cannot reach another Shoko, gathers three more Shokos through repeated neighborhood visits, and discovers the missing Shoko hosting an after-party with his phone on silent.
- Homage: a clear structural homage to `Adon Shoko`, using preparation, visits, doors and a growing male group. Do not copy lyrics, melody, recording, dialogue, distinctive shots or protected creative expression.

## Character naming lock

Every principal man is named **Shoko** on screen. Production labels exist only to prevent continuity mistakes:

| Persistent ID | Internal label | Distinguishing function |
| --- | --- | --- |
| `CHAR_001` | Shoko A | protagonist; dark hat and walking stick |
| `CHAR_003` | Shoko B | first searcher; oversized bag |
| `CHAR_004` | Shoko C | cafe searcher; coffee and pastry; Eilat line |
| `CHAR_005` | Shoko D | searcher with the giant spare key |
| `CHAR_002` | Shoko E | missing friend and after-party host; barefoot with sunglasses indoors |

The former active labels Yossi, Moti and Avi are superseded. They are not additional characters. Historical documents may retain them as development history.

## Canonical dialogue

Keep dialogue in Hebrew and verify every line before putting text into a storyboard card or model payload:

1. Shoko A: `שוקו לא עונה. אני הולך לבדוק.`
2. Shoko A: `ראית את שוקו?`
3. Shoko B: `לא. אני בא איתך.`
4. Shoko C: `אולי הוא נסע לאילת.`
5. Shoko B: `שוקו לא אוהב חול.`
6. Shoko A: `חיפשנו אותך בכל השכונה.`
7. Shoko E: `אותי? אני חיכיתי לכם.`
8. Off-screen final line: `מי הזמין את ועד הבית?`

Do not ask an image model to render Hebrew dialogue inside the cinematic frame. Display dialogue as HTML text in the dashboard beside the image so it remains exact and editable.

## Dialogue visibility and lip-sync lock

Dialogue written in a screenplay or dashboard is not automatically spoken by a generated face. Every shot pack must declare `dialogue_visibility` (`none`, `offscreen`, `visible_speaker`), `audio_mode` (`silent_visual`, `post_production`, `native_audio_video`, `external_voice_lipsync`) and `lip_sync_required`. A visible speaker is blocked until an approved Hebrew voice asset, timing plan and dedicated lip-sync route exist. The canonical routing and storage rules are in `36_Audio_LipSync_Contract_v0.1.md`.

Current shots S001 and S002 are silent visuals. S003's line is explicitly offscreen/post-production, so its current visual pass does not promise mouth movement. Future visible-speaking shots (including S005, S006, S010 and S014) require the external voice → lip-sync → mix → QC path before `READY`.

## Current production state

- Story, runtime, all-male cast, all-Shoko naming rule, protagonist direction, after-party ending and vertical format are approved.
- The canonical screenplay and 16-shot list exist.
- S001 and S002 have real Fal review videos. S003 v0.3 is now `REVISE`: the phone-face orientation is ambiguous during handling. S005 v0.2 is `REVISE`: CHAR_001 crosses toward the doorway interior in late frames.
- No later shot is `READY` for video generation.
- The public dashboard source is in `dashboard/`.
- GitHub Pages deployment is defined in `.github/workflows/deploy-dashboard.yml`.
- One valid `CHAR_001` / Shoko A reference sheet now exists at `assets/characters/CHAR_001_reference_sheet_v0.2.png`; it is `REVIEW`, not `APPROVED`.
- `36_Audio_LipSync_Contract_v0.1.md` now governs speech visibility, Hebrew voice assets and dedicated lip-sync for visible speakers.
- `38_AI_Video_QC_and_Prompting_Contract_v0.1.md` governs dense frame-level artifact review and repair prompts. A clip cannot be accepted from its first frame alone.

## Critical image-asset problem

The 18 legacy PNGs under `assets/characters/`, `assets/environments/`, `assets/keyframes/` and `assets/props/` have PNG headers but are truncated and fail complete decoding. Preserve them and their versions as historical evidence; do not overwrite or present them as usable model inputs.

The PNGs under `assets/review/` are valid schematic previs boards, not cinematic model-input stills. The user explicitly wants real generated reference images and shot stills, not diagrams.

The existing dry-run payloads under `data/` still contain `example.com` placeholder URLs. Do not claim that those URLs are hosted model inputs. Do not execute them.

## Next production objective

Current gate: the first image below has been completed. Stop and wait for Ben to choose `Approve`, `Revise` or `Reject` before generating any other asset.

Create a new, valid, versioned still-image approval pipeline, one asset at a time:

1. Generate one real reference sheet for `CHAR_001` / Shoko A.
2. Save it non-destructively as a new version; never overwrite the corrupt legacy file.
3. Validate full image decoding, dimensions, color mode and file hash.
4. Add the exact image to the dashboard.
5. Show beside it the persistent ID, version, `REVIEW` status, exact generation model/provider, exact prompt and constraints, intended future model-input use, and review choices.
6. Stop for user approval before generating Shoko B-E, environments, props or shot keyframes.

The first image should be a neutral cinematic character reference sheet, not a video frame and not a multi-character scene. It should establish Shoko A's distinct older Israeli male identity, silver-gray hair, lean-to-average proportions, pale shirt, restrained brown cardigan, charcoal trousers, polished dark shoes, related dark hat and plain wooden walking stick. Avoid caricature, logos, text, watermarks and costume variants.

## Credentials and cost safety

- A Gemini key was pasted into a prior chat and must be treated as compromised. Never recover, reuse, echo or commit it.
- Use only a newly rotated credential supplied through the Codex secret/environment mechanism, for example `GEMINI_API_KEY`; never request that its value be pasted into chat.
- Before a paid image call, identify the exact model and estimated cost or free-tier behavior and request explicit approval for that bounded operation.
- Never call Fal, generate video, upload model references or spend money without explicit approval for the exact operation.
- Never commit `.env`, API keys, tokens, credentials or provider response secrets.

## Dashboard acceptance criteria

The public review page must show exactly what will be supplied to a downstream model:

- actual decodable source image, full-size link and thumbnail;
- filename, persistent ID, version and SHA-256;
- exact prompt and constraints;
- model/provider and generation date;
- downstream role such as start frame or identity reference;
- exact Hebrew dialogue and sound plan as selectable web text, not baked into the image;
- honest state labels: `MISSING`, `REVIEW`, `APPROVED`, `REJECTED` or `CORRUPT`.

Browser-local approvals are not canonical until written back into the Production Bible and committed.

## Required verification before handback

At minimum:

```bash
git diff --check
node --check dashboard/app.js
python3 -m http.server 4173
```

Also fully decode every newly generated raster with Pillow, verify every dashboard asset URL locally, and take desktop and mobile screenshots for perceptible dashboard changes when browser tooling is available.

Commit changes on `work`, push them, and update the existing pull request. Do not open a duplicate PR if one is already open for `work`.

## Copy/paste prompt for the next Codex agent

```text
Continue the ai-cinematic-film project from branch work.

Read the repository completely, beginning with README.md, 00_Project_Index.md,
02_Production_Bible.md, 32_Short_Film_Screenplay_v0.3_60s.md,
33_Shot_List_v0.2_60s.md, 34_Visual_Review_Pack_001.md and
35_CODEX_HANDOFF.md. Treat the repository as the single source of truth.

All five principal men are named Shoko on screen. Keep persistent CHAR_### IDs
and internal Shoko A-E labels for continuity. Preserve approved decisions and
rejected experiments.

Next, create exactly one real, decodable, versioned reference image for
CHAR_001 / Shoko A using an available image-generation tool or a newly rotated
credential supplied through Codex Secrets. Never use the Gemini credential that
was pasted into chat. Before any paid call, state the exact model and bounded
estimated cost and get my explicit approval.

Save the new image non-destructively in the project, validate it, and add the
actual image to the public dashboard with its exact prompt, provider/model,
version, SHA-256, intended downstream model-input role, and REVIEW status.
Keep Hebrew dialogue as exact HTML text beside images; do not bake it into
generated frames. Stop after this first image so I can approve, revise or reject it.

Do not call Fal, generate video, upload references to a video model or spend
money without explicit approval for the exact operation. Commit to work, push,
and update the existing PR.
```
