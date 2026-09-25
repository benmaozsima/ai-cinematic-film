import test from 'node:test';
import assert from 'node:assert/strict';
import { buildContinuitySchema, generatedContinuityAssets } from '../server/director-continuity.mjs';

test('a recurring multi-shot world gets one shared locked master plan', () => {
  const shots = [1, 2, 3, 4].map((number) => ({ id: `beat-${number}`, visibleAction: `Inside the same sukkah, beat ${number}.` }));
  const schema = buildContinuitySchema({ brief: { source: 'A couple builds, enjoys and accidentally collapses one sukkah.' }, shots, inputs: [
    { id: 'man', kind: 'image', role: 'identity', label: 'Man', scope: 'all' },
    { id: 'woman', kind: 'image', role: 'identity', label: 'Woman', scope: 'all' },
  ] });
  const generated = generatedContinuityAssets(schema);
  assert.equal(generated.length, 1);
  assert.equal(generated[0].type, 'set');
  assert.equal(generated[0].id, 'set-world-master');
  assert.deepEqual(generated[0].scopeShotIds, shots.map((shot) => shot.id));
  assert.equal(schema.shots.every((shot) => shot.assetIds.includes('set-world-master')), true);
  assert.equal(schema.gates.requireApprovedMastersBeforeVideo, true);
});

test('an uploaded location is reused and suppresses duplicate world generation', () => {
  const shots = [{ id: 'beat-1', visibleAction: 'Room' }, { id: 'beat-2', visibleAction: 'Same room' }];
  const schema = buildContinuitySchema({ brief: { source: 'Two shots in the same room.' }, shots, inputs: [
    { id: 'room', kind: 'image', role: 'location', label: 'Room', scope: 'all' },
  ] });
  assert.equal(generatedContinuityAssets(schema).length, 0);
  assert.equal(schema.assets[0].masterVersionId, 'room');
  assert.equal(schema.assets[0].locked, true);
});

test('a recurring bartender gets one identity master even without dialogue or an upload', () => {
  const shots = [
    { id: 'beat-1', visibleAction: 'The bartender places tools on the bar.' },
    { id: 'beat-2', visibleAction: 'The bartender shakes the cocktail.' },
  ];
  const schema = buildContinuitySchema({ brief: { source: 'A premium bartender prepares a margarita in a dark cocktail bar.' }, shots });
  const generated = generatedContinuityAssets(schema);
  assert.equal(generated.filter((asset) => asset.type === 'character').length, 1);
  assert.equal(generated.find((asset) => asset.type === 'character')?.name, 'Professional bartender');
  assert.ok(generated.find((asset) => asset.type === 'set')?.canonicalDescription.includes('dark cocktail bar'));
  assert.equal(schema.shots.every((shot) => shot.assetIds.some((id) => id.startsWith('character-'))), true);
});
