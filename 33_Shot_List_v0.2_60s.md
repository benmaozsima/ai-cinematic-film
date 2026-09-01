# Shot List v0.2 - The Search Party 60s

Status: DESIGNED / PRE-PRODUCTION
Exact runtime: 60 seconds
Master: 9:16 vertical, 1080x1920
Generation gate: No paid generation; exact cost and separate approval required

| ID | Time | Duration | Purpose | Camera / Composition | Action | Characters / Location | Audio | Status |
|---|---:|---:|---|---|---|---|---|---|
| S001 | 0:00 | 3s | Establish ritual | ECU low, locked | Cloth polishes Shoko A's dark shoe | CHAR_001 / apartment | Cloth, faint clock | DESIGNED |
| S002 | 0:03 | 3s | Lock Shoko A identity | Mirror CU, subtle push | Shoko A combs silver hair once | CHAR_001 / apartment | Comb, room tone | DESIGNED |
| S003 | 0:06 | 4s | State problem and launch | Phone insert to medium | Unanswered calls; Shoko A takes hat and stick and says he will check | CHAR_001 / apartment | Dialogue, buzz stops, cane | DESIGNED |
| S004 | 0:10 | 4s | Begin recognizable route | Vertical rear follow | Shoko A walks toward the first door | CHAR_001 / LOC_001 | Steps, cane, original rhythm begins | DESIGNED |
| S005 | 0:14 | 4s | Add first man | Centered doorway two-shot | Shoko B answers; Shoko A asks about Shoko | CHAR_001, CHAR_003 / LOC_001 | Dialogue | DESIGNED |
| S006 | 0:18 | 4s | Establish chain rule | Medium, slight pan | CHAR_003 locks up with oversized bag and joins | CHAR_001, CHAR_003 / LOC_001 | "I'm coming", lock click | DESIGNED |
| S007 | 0:22 | 4s | Add Shoko C | Cafe doorway, vertical depth | Shoko C steps into the route with coffee and pastry | CHAR_001, CHAR_003, CHAR_004 / LOC_001 | Cafe clatter, footsteps | DESIGNED |
| S008 | 0:26 | 4s | Add Shoko D | Symmetrical doorway | Shoko D joins while presenting giant spare key | Group, CHAR_005 / LOC_001 | Key jingle | DESIGNED |
| S009 | 0:30 | 4s | Deliver visual homage | Vertical depth group tracking | Four men march in orderly single file | CHAR_001, CHAR_003-005 / LOC_001 | Steps, cane, original music | DESIGNED |
| S010 | 0:34 | 3s | One theory joke | Tight walking two-shot | Shoko C suggests Eilat; Shoko B says Shoko hates sand | CHAR_003, CHAR_004 / LOC_001 | Dialogue | DESIGNED |
| S011 | 0:37 | 4s | Announce destination | Tall facade, slow tilt down | Group reaches Shoko's building; muffled bass leaks out | Group / LOC_003 exterior | Bass, laughter | DESIGNED |
| S012 | 0:41 | 3s | Hold before reveal | Low centered door angle | Group looks to Shoko A; he knocks; music stops | Group / LOC_003 hallway | Knock, sudden silence | DESIGNED |
| S013 | 0:44 | 5s | Reveal Shoko E and party | Floor-to-ceiling doorway wide | Door opens on barefoot Shoko E in sunglasses and warm party | CHAR_002, group / LOC_003 | Music returns softly | DESIGNED |
| S014 | 0:49 | 5s | Deliver reversal | Two separate close reactions | Shoko A says they searched; Shoko E says he waited | CHAR_001, CHAR_002 / LOC_003 | Dialogue, comic pause | DESIGNED |
| S015 | 0:54 | 3s | Resolve with warmth | Interior medium | Shoko C takes a cup and enters; others follow | Group / LOC_003 | Cup, laughter | DESIGNED |
| S016 | 0:57 | 3s | Final punchline | Centered exterior doorway | Shoko A smiles and enters; door closes | Group / LOC_003 | "Who invited the building committee?" | DESIGNED |

Total planned duration: **60 seconds**.

## Continuity locks

- Shoko A reference candidate: `assets/characters/CHAR_001_reference_sheet_v0.2.png` (`REVIEW`); corrupt v0.1 remains historical only.
- Canonical group reference: `assets/characters/GROUP_SHOKO_v0.3.png`; corrupt v0.2 remains historical only.
- Canonical neighborhood reference: `assets/environments/LOC_001_reference_sheet_v0.1.png`.
- Canonical party reference: `assets/environments/LOC_002_party_apartment_sheet_v0.1.png`, registered as `LOC_003` despite the legacy filename.
- Shoko A alone carries the walking stick. Shoko B has the bag, Shoko C has coffee/pastry, and Shoko D has the key.
- Maintain forward screen direction through S004-S011.
- Party haze, colored accents and warm interior light appear only from S013.

## Audio performance plan

S003 is currently an offscreen/post-production line, so the existing visual test is intentionally silent. S005, S006, S010, S014 and S016 contain spoken lines that must be staged as visible speech or explicitly restaged as offscreen/voice-over before generation. If the speaker's mouth is visible, attach a voice asset, timing plan and dedicated lip-sync pass; do not treat subtitles or a dialogue field as a substitute.

## Transition performance plan

The sequence is designed as handoffs, not isolated clips. Use the map in 37_Transition_Continuity_Contract_v0.1.md: lock each incoming/outgoing state, screen direction, eyeline, prop position, grade and audio bridge in the shot payload. Generate the final pose needed by the next shot and reject any continuity break instead of hiding it with an edit.

## Readiness gate

No shot is `READY` yet. Supporting close-up identity references, Shoko's canonical face, shot-specific keyframes, exact model price and explicit paid-generation approval are still required.

The recommended first motion candidate remains S002 because it tests Shoko A with one restrained action and no multi-character continuity risk. It remains blocked until reference v0.2 is approved and a separate video-model cost gate is satisfied.
