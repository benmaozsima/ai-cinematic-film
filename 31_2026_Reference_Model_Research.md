# 2026 Reference Model Research

Date: 2026-08-28
Status: RESEARCHED

## Confirmed from provider documentation

### Fal CDN and files

Local files can be uploaded to fal's CDN to obtain URLs accepted by model inputs. The CDN is the universal input path. Uploaded inputs and generated outputs are subject to retention controls. Default CDN URLs may be publicly accessible by link.

### Seedance 2.5 reference-to-video

The endpoint accepts multimodal references: images, video, audio and style inputs. The documented limit is up to 50 total multimodal references, with images referenced in the prompt as `@Image1`, `@Image2`, and so on. This is a capacity limit, not a recommendation to send 50 images. For our short, shot-specific sets of 3-8 references are more controllable.

### Seedance 2.5 image-to-video

The first image establishes subject, palette and composition while the prompt should focus primarily on motion, camera and sound. An optional end image can control the destination composition. This is the default candidate for approved keyframe animation.

### Veo 3.1 reference-to-video

The reference workflow combines one or more reference images with a prompt describing the action, style, camera movement and ambience. It is a candidate for a hero reveal or a difficult doorway beat, not necessarily every cheap draft.

### Kling reference workflows

Kling documents multi-image Elements workflows for character consistency and interaction, and newer reference-to-video endpoints for preserving characters, objects and environments. It is a candidate when we need explicit control over several recurring subjects.

## Strong inference from research and production reports

1. Consistency is improved by locking identity before animation.
2. A character pack should cover face, hair, clothing, body shape, props, expressions and the expected camera angles.
3. Environment packs should lock geography, architecture, color, light direction and recurring objects.
4. The best reference set is shot-specific, not maximal. Conflicting alternatives reduce control.
5. A start keyframe is stronger than a text-only prompt for composition and wardrobe.
6. First/last-frame control is useful for entrances, turns, reveals and transitions.
7. Short clips, repeated motion language, screen direction and sound bridges are editorial controls that compensate for model variation.
8. A final grade, consistent aspect ratio and unified sound design are required to merge outputs from different models.

## Practical policy for this project

- Build the full reference pack before buying video seconds.
- Keep one canonical reference for each identity and label every alternative as draft or rejected.
- Use the same image model and prompt grammar for a reference family where possible.
- Use the smallest reference subset that answers the shot's needs.
- Send the previous shot's end frame when a shot continues movement or geography.
- Describe changes in the prompt rather than re-describing every visible detail.
- Treat every generated clip as an experiment with a recorded model, prompt, references, settings and result.

## Cost and upload conclusion

The public Fal documentation separates input-file upload from model inference pricing. It does not establish a universal zero-cost guarantee for every account's storage, retention or transfer behavior. Exact model pricing can be account-specific; Fal's pricing API requires authentication and notes that custom pricing or discounts may apply. Therefore:

- uploading a reference is not the same operation as generating video
- we should expect no model-inference charge merely for preparing a URL, but verify account behavior before batch uploads
- upload only the few references needed for one approved test
- use the dashboard/pricing endpoint to verify exact account pricing before execution

## Sources

- Fal CDN: https://fal.ai/docs/documentation/model-apis/fal-cdn
- Fal working with files: https://fal.ai/docs/documentation/development/working-with-files
- Fal Seedance 2.5 image-to-video: https://fal.ai/models/bytedance/seedance-2.5/image-to-video
- Fal Seedance 2.5 reference-to-video: https://fal.ai/models/bytedance/seedance-2.5/reference-to-video
- Fal Seedance 2.5 reference API: https://fal.ai/models/bytedance/seedance-2.5/reference-to-video/api
- Fal Veo 3.1 reference-to-video: https://fal.ai/models/fal-ai/veo3.1/reference-to-video/api
- Kling Elements: https://kling.ai/quickstart/ai-video-character-consistency
- Fal pricing: https://fal.ai/docs/platform-apis/v1/models/pricing
