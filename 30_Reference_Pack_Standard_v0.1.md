# Reference Pack Standard v0.1

Status: DESIGNED
Purpose: Define the minimum reference library before video generation.

## Principle

One beautiful image is a look reference. A usable production reference pack is a controlled identity and continuity system. We will not send every image to every model. We will select the smallest relevant subset for each shot.

## CHAR_001 minimum pack

1. Neutral front portrait, clean face and hair.
2. Neutral three-quarter portrait.
3. Left profile.
4. Right profile.
5. Full-body front.
6. Full-body three-quarter.
7. Full-body walking left-to-right.
8. Full-body walking right-to-left, only if the story requires a direction reversal.
9. Seated pose.
10. Expression set: neutral, polite greeting, mild concern, comic confusion, relief.
11. Wardrobe reference: shirt, cardigan, trousers, shoes, hat and stick clearly visible.
12. Hands and prop reference: grip on cane, phone, hat and envelope.
13. Mirror/reflection reference.
14. Group reference with the other Shoko characters.

The first three generated images are anchors, not yet a complete pack. Missing angles should be generated from the approved identity reference, with no redesign.

## Supporting Shoko pack

For each recurring friend who speaks or receives a closeup:

- front portrait
- three-quarter portrait
- full-body wardrobe pose
- one walking pose
- one personal prop pose
- one expression reference

For background friends used only in wide group shots, the group sheet is sufficient until a closeup is planned.

## Environment pack

### LOC_001 old neighborhood

- master vertical establishing frame
- apartment entrance
- sidewalk with tree and low wall
- cafe frontage
- courtyard/stairwell
- street corner for the group march
- morning light version
- flatter noon version
- late-afternoon version

### LOC_002 party apartment

- exterior building entrance
- closed apartment door in hallway
- doorway reveal from outside
- interior wide from doorway
- kitchen/party insert angle
- empty-after-party version for continuity if needed
- cool hallway / warm interior lighting pair

## Object pack

- `PROP_001` wooden walking stick: full view, handle closeup, contact with pavement
- `PROP_002` dark formal hat family: one per recurring Shoko, matched materials
- `PROP_003` oversized tote bag
- `PROP_004` coffee cup and pastry
- `PROP_005` giant spare key
- `PROP_006` phone with unread messages, created without readable platform branding
- `PROP_007` apartment doorbell and handle
- `PROP_008` small party speaker, cups and haze elements

## Style pack

- vertical 9:16 master framing
- realistic cinema, 35mm for environment and group, 50mm for faces
- warm pale morning light in the search opening
- muted cream, faded green, brown, charcoal and oxidized red palette
- restrained contrast and natural skin texture
- no logos, readable random text, watermarks or celebrity resemblance

## Shot-specific reference selection

For a normal character walking shot, send:

- exact character identity reference
- full-body wardrobe reference
- current location angle
- previous shot end frame when continuing movement
- optional style frame only if the location or light changes

For a group shot, send:

- group sheet
- current group arrangement reference
- location frame
- one prop reference per visible comic object

Do not send unrelated faces, alternate wardrobe versions or rejected generations. More references are not automatically better; conflicting references create ambiguity.

## Model-specific guidance

Seedance 2.5 reference-to-video can accept many multimodal references, but use only the relevant subset for a shot. Seedance 2.5 image-to-video is appropriate when one approved start frame already contains the composition. Veo 3.1 reference-to-video is appropriate for a hero beat when several references and precise motion need to be combined. Kling Elements/reference workflows are useful when a shot needs explicit multi-subject identity control.

## QC before upload

- face matches the approved identity
- hairline and age are stable
- wardrobe and hat family are correct
- hands and props are physically plausible
- no extra characters or unexplained objects
- vertical framing leaves safe space for platform overlays
- file is sharp, clean and free of watermarks
- version and asset ID are recorded

## Upload and privacy rule

Fal's CDN is the universal input path for local files, but uploaded input files are stored under the same retention system as generated media. Default CDN URLs may be publicly accessible to anyone with the link. Upload only the exact references needed for an approved test, and record the returned URL without exposing it in prompts or chat unnecessarily.

## Gate

No paid video generation until the relevant reference pack, shot payload, price estimate and budget approval all exist.
