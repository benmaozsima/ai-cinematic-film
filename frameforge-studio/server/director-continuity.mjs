const speakerPattern = /^\s*([A-Z][A-Za-z .'-]{1,32}):\s*[“"]?[^\n”"]+/gmu;

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'asset';
}

export function buildContinuitySchema({ brief, shots = [], inputs = [] }) {
  const shotIds = shots.map((shot) => shot.id);
  const assets = inputs.map((input, index) => ({
    id: `source-${input.id}`,
    type: input.role === 'identity' ? 'character' : ['location', 'set'].includes(input.role) ? 'set' : input.role === 'wardrobe' ? 'wardrobe' : input.role === 'prop' || input.role === 'product' ? 'prop' : 'style',
    name: input.label || `Supplied ${input.kind} ${index + 1}`,
    canonicalDescription: `User-supplied ${input.role || 'continuity'} reference. Preserve its defining visual details exactly.`,
    immutable: ['identity', 'shape', 'materials', 'colors', 'proportions'],
    source: 'upload', sourceVersionIds: [input.id], masterVersionId: input.id,
    requiredViews: ['master'], scopeShotIds: input.scope === 'all' || input.scope === 'auto' ? shotIds : [input.scope], status: 'source', locked: true,
  }));
  const identityCount = assets.filter((asset) => asset.type === 'character').length;
  const speakers = [...new Set(shots.flatMap((shot) => [...String(shot.visibleAction || '').matchAll(speakerPattern)].map((match) => match[1].trim())))];
  for (const name of speakers.slice(identityCount)) assets.push({
    id: `character-${slug(name)}`, type: 'character', name,
    canonicalDescription: `Canonical identity and wardrobe master for ${name}, derived from the approved film brief. Neutral reference pose; no story action.`,
    immutable: ['face', 'age', 'hair', 'body proportions', 'wardrobe', 'signature accessories'],
    source: 'generate', sourceVersionIds: [], masterVersionId: null, requiredViews: ['master'], scopeShotIds: shotIds, status: 'needs_master', locked: false,
  });
  if (shots.length > 1 && !assets.some((asset) => asset.type === 'set')) assets.push({
    id: 'set-world-master', type: 'set', name: 'Recurring world, set and hero props',
    canonicalDescription: `A clean continuity master of the recurring environment, architecture, set structure, decoration layout and hero props described in this film: ${String(brief.source || brief).slice(0, 4000)}`,
    immutable: ['layout', 'geometry', 'materials', 'palette', 'doors and openings', 'decorations', 'hero props', 'lighting direction'],
    source: 'generate', sourceVersionIds: [], masterVersionId: null, requiredViews: ['master'], scopeShotIds: shotIds, status: 'needs_master', locked: false,
  });
  return {
    schemaVersion: 1,
    assets,
    shots: shots.map((shot) => ({ id: shot.id, assetIds: assets.filter((asset) => asset.scopeShotIds.includes(shot.id)).map((asset) => asset.id), continuityRequirements: ['Use the same approved master references', 'Do not redesign recurring identities, set geometry, wardrobe or hero props'] })),
    gates: { requireApprovedMastersBeforeVideo: true, reuseMastersOnRetry: true },
  };
}

export function generatedContinuityAssets(schema) {
  return (schema?.assets || []).filter((asset) => asset.source === 'generate');
}
