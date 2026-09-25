const speakerPattern = /^\s*([A-Z][A-Za-z .'-]{1,32}):\s*[“"]?[^\n”"]+/gmu;

function slug(value) {
  return String(value).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 48) || 'asset';
}

function conciseSetDescription(source) {
  const text = String(source || '');
  const candidates = [
    /dark[^.\n]{0,180}(?:bar|cocktail bar)[^.\n]*/i.exec(text)?.[0],
    /premium[^.\n]{0,180}(?:bar|cocktail)[^.\n]*/i.exec(text)?.[0],
    /(?:wooden|glass|metal|black)[^.\n]{0,180}(?:counter|bar|shelf)[^.\n]*/i.exec(text)?.[0],
  ].filter(Boolean);
  const props = ['jigger', 'shaker', 'strainer', 'coarse salt', 'fresh lime', 'ice', 'frosted glass']
    .filter((item) => text.toLowerCase().includes(item));
  const base = candidates[0] || 'The same recurring production set and environment across every shot.';
  return `${base.replace(/[.!?]+$/, '')}. Preserve the exact layout, materials, lighting direction and hero props${props.length ? ` (${props.join(', ')})` : ''}. Neutral continuity reference, no story action, no text, no people.`;
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
  const ignoredLabels = new Set(['audio', 'style', 'camera', 'lighting', 'shot', 'sequence', 'important details', 'final on-screen text']);
  const speakers = [...new Set(shots.flatMap((shot) => [...String(shot.visibleAction || '').matchAll(speakerPattern)].map((match) => match[1].trim()).filter((name) => !ignoredLabels.has(name.toLowerCase()))))];
  for (const name of speakers.slice(identityCount)) assets.push({
    id: `character-${slug(name)}`, type: 'character', name,
    canonicalDescription: `Canonical identity and wardrobe master for ${name}, derived from the approved film brief. Neutral reference pose; no story action.`,
    immutable: ['face', 'age', 'hair', 'body proportions', 'wardrobe', 'signature accessories'],
    source: 'generate', sourceVersionIds: [], masterVersionId: null, requiredViews: ['master'], scopeShotIds: shotIds, status: 'needs_master', locked: false,
  });
  // A recurring performer still needs an identity master even when the brief
  // does not contain dialogue or a `Name:` line. This prevents each shot from
  // inventing a different bartender, host or presenter.
  if (shots.length > 1 && !assets.some((asset) => asset.type === 'character')) {
    const source = String(brief.source || brief).toLowerCase();
    const performerMentioned = /bartender|barista|mixologist|host|presenter|actor|actress|character|man|woman|person|דמות|גבר|אישה|שחקן|שחקנית/i.test(source);
    const name = /bartender|barista|mixologist|bartender's/i.test(source) ? 'Professional bartender' : 'Primary recurring performer';
    if (!performerMentioned) {
      // A set-only brief should not acquire a fictional person merely because
      // it has multiple shots.
    } else assets.push({
      id: `character-${slug(name)}`, type: 'character', name,
      canonicalDescription: `Canonical identity and wardrobe master for the ${name.toLowerCase()}. Neutral full-body studio reference with consistent face, body proportions, hair, wardrobe and accessories; no story action, no text.`,
      immutable: ['face', 'age', 'hair', 'body proportions', 'wardrobe', 'signature accessories'],
      source: 'generate', sourceVersionIds: [], masterVersionId: null, requiredViews: ['master'], scopeShotIds: shotIds, status: 'needs_master', locked: false,
    });
  }
  if (shots.length > 1 && !assets.some((asset) => asset.type === 'set')) assets.push({
    id: 'set-world-master', type: 'set', name: 'Recurring world, set and hero props',
    canonicalDescription: conciseSetDescription(brief.source || brief),
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
