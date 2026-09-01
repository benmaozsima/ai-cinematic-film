# AI Video QC and Prompting Contract v0.1

Status: Canonical production safeguard. Created after frame-level review of S003 and S005 on 2026-09-01.

## Why this exists

A clip can decode, look good in its first frame, and still be unusable. S003 showed an ambiguous phone-face orientation during handling; S005 began as a correct doorway conversation but ended with CHAR_001 crossing toward the home. Both must be caught before a clip enters an assembly.

## The two-stage review rule

1. **Technical gate:** decode with FFmpeg; verify codec, dimensions, duration, frame rate, audio streams, file size and SHA-256.
2. **Narrative and temporal gate:** inspect a dense contact sheet at 6 fps plus the first, action-peak and final frames. Review the whole clip in motion after the contact-sheet pass.

No clip is `APPROVED` until both gates pass. A beautiful first frame never overrides a bad final state.

## Mandatory frame-level checklist

For every generated clip, record PASS / REVISE / REJECT for:

- **Identity:** face, age range, gender, hair, wardrobe and character count stay locked.
- **Props:** each PROP remains singular, in the correct owner’s hand, at the correct orientation. For screens: display is on the front face, readable side faces camera when required, and the back never becomes a fake display.
- **Anatomy:** hands, fingers, limbs, gait, grip and contacts do not duplicate, disappear or melt.
- **Blocking:** each character stays on the permitted side of the threshold/frame; no unplanned entry, exit or position swap.
- **Action beats:** the requested beat happens once, in order, with a stable start and end pose.
- **Scene:** location geometry, doorway axis, lighting and screen direction stay stable.
- **Generation artifacts:** no text/subtitles/logos, morphing, ghost people, sudden age/ethnicity shifts, frame flicker or object teleportation.
- **Handoff:** final frame matches the next shot’s required incoming state.

Any failure is `REVISE`; do not hide it in editing.

## Prompt construction rule for image-to-video

Use an approved start keyframe as the visual source. Do not re-describe the whole image repeatedly; tell the model only the permitted motion, the required end state and the prohibited change. This follows current reference-to-video guidance: source images control identity/style, while the prompt should concentrate on motion and camera behavior.

Every prompt must include these blocks:

1. **Frozen invariants:** named CHAR/LOC/PROP IDs, exact character count, wardrobe, prop ownership, camera and threshold/axis.
2. **Single permitted action:** one small action per 4-second shot.
3. **End-frame contract:** precise pose and location that must be true in the final second.
4. **Negative constraints:** forbid extra people, gender/age drift, prop swaps, display reversal, threshold crossing, text, logos, subtitles, camera drift and unintended audio.
5. **Cut point:** state the intended cut before any action that belongs to the next shot.

## Repair specifications now active

### S003 — phone / launch

- The phone stays in CHAR_001’s hand only while its lit display visibly faces the camera.
- CHAR_001 places the phone screen-up on the table; the display must never appear on the back.
- After that cut point, he puts on the hat and lifts the cane. The phone does not move again.

### S005 — first door

- CHAR_001 remains fully outside for the entire clip; both feet stay on the exterior threshold side.
- CHAR_003 remains inside/at the doorway and does not invite or pull CHAR_001 in.
- The shot ends on a locked two-shot conversation hold. S006, not S005, contains the door-lock and departure action.

## Model-selection learning

Fal Seedance remains useful for short silent motion tests, but single-image I2V cannot be assumed to preserve a multi-character cast through later story beats. For repairs involving several locked faces or dialogue, generate a shot-specific keyframe first and consider a reference-to-video system that accepts multiple subject references and explicit first/last-frame control. Do not change provider or spend money without a separate cost gate and approval.

## Sources consulted

- Google Cloud: [Veo prompting guide](https://cloud.google.com/blog/products/ai-machine-learning/ultimate-prompting-guide-for-veo-3-1) — structured cinematography/subject/action/context/style prompts; reference ingredients and first/last-frame transitions.
- Google Cloud: [video-generation best practices](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/best-practice) — strong source frame and motion-focused prompts for I2V.
- Google Cloud: [reference-to-video documentation](https://docs.cloud.google.com/gemini-enterprise-agent-platform/models/video/generate-videos-from-references) — multiple subject references for maintaining subject appearance.
- Chen et al., [Artifact-Aware Evaluation for High-Quality Video Generation](https://arxiv.org/abs/2601.20297) — artifact categories should be assessed explicitly, not reduced to a single aesthetic score.

