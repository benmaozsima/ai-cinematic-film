# Transition & Continuity Contract v0.1

Date: 2026-09-01  
Status: canonical production infrastructure decision

## Goal

Every shot is generated as a handoff: it must begin from the previous shot's declared exit state and end in the next shot's declared entrance state. Editing should assemble approved shots, not repair mismatched identity, direction, props, light or performance.

## Required transition fields

Each shot pack must declare:

- \`incoming_state\`: character pose, eyeline, hand/prop position, screen direction, lighting and sound at the first frame.
- \`outgoing_state\`: the same fields at the last frame.
- \`transition_device\`: \`hard_cut\`, \`match_action\`, \`eyeline\`, \`motion_continuation\`, \`sound_bridge\`, \`doorway_wipe\`, \`reaction_cut\` or an explicitly approved alternative.
- \`match_priorities\`: ordered invariants; identity/prop/direction outrank camera flourish.
- \`audio_bridge\`: exact ambience, Foley or dialogue overlap that carries across the cut.
- \`edit_fallback\`: the smallest permitted trim or cut point if the generated endpoint is imperfect; never invent a new story beat.

The generator must be told the endpoint state in the prompt. A shot is not \`READY\` until its first and last sampled frames pass the handoff QC.

## The Search Party handoff map

| Cut | Device | Handoff lock |
| --- | --- | --- |
| S001→S002 | \`sound_bridge\` + hard cut | warm interior grade and faint clock continue; shoe ritual becomes mirror ritual |
| S002→S003 | \`eyeline\` + match action | CHAR_001 face/wardrobe and eye focus lead from reflection to phone |
| S003→S004 | \`motion_continuation\` | hat/cane final state becomes rear-follow walk; forward screen direction stays fixed |
| S004→S005 | \`eyeline\` + doorway | cane rhythm and forward walk resolve into the first door axis |
| S005→S006 | \`match_action\` + sound bridge | same doorway axis; lock click motivates Shoko B joining |
| S006→S007 | \`motion_continuation\` | bag swing and group direction continue into cafe entrance |
| S007→S008 | \`prop_match\` | coffee/pastry remain with Shoko C while giant key becomes the new visual accent |
| S008→S009 | \`formation_match\` | four men settle into the canonical single-file formation |
| S009→S010 | \`motion_continuation\` | walking cadence, hats and cane continue; dialogue is mixed over the move |
| S010→S011 | \`sound_bridge\` | Eilat joke resolves into approaching bass/laughter before the building reveal |
| S011→S012 | \`reaction_cut\` + sound cut | facade/approach lands on the knock; music stops on the beat |
| S012→S013 | \`doorway_wipe\` | the opening door reveals the warm party and CHAR_002 |
| S013→S014 | \`eyeline\` + reaction | CHAR_002 and CHAR_001 eyelines remain screen-consistent across the reveal |
| S014→S015 | \`match_action\` | Shoko C's hand/cup enters the party space and motivates everyone entering |
| S015→S016 | \`reaction_cut\` + door close | CHAR_001 smile resolves the joke; door closes on the final line |

## Minimal-edit rule

Do not use a transition to hide a broken face, changed wardrobe, duplicated prop, axis flip or missing dialogue performance. Mark the shot \`REVISE\`, preserve the rejected version, and regenerate only after correcting the endpoint contract. Trimming a few frames is allowed only when the declared handoff remains intact.

## Reusable infrastructure

The dashboard should expose the selected version for each shot and the transition status. The media registry keeps every version; an assembly chooses one version per shot without deleting alternatives. Future films reuse this contract with new IDs and a new handoff map.
