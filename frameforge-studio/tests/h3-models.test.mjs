import { test } from 'node:test';
import assert from 'node:assert/strict';
import { MODELS, buildInput, estimate, supportedDuration } from '../server/models.mjs';
import { recommendModels } from '../server/model-router.mjs';

test('fal H3 variants build provider-compatible payloads and guard input limits', () => {
  const models = MODELS.filter(m => m.id.startsWith('minimax/h3-max'));
  assert.equal(models.length, 5);
  for (const m of models.filter((candidate) => !candidate.id.endsWith('/reference-to-video'))) {
    const image = m.fields.includes('image_url');
    const refs = image ? { image_url: 'asset:first', end_image_url: 'asset:last' } : {};
    const input = buildInput(m, 'A robot waves', { ...refs, duration: '5', aspect_ratio: '9:16', seed: 42 });
    assert.equal(input.duration, 5);
    assert.equal(input.resolution, '480P');
    assert.equal(input.prompt_expansion_mode, 'disabled');
    assert.equal(input.generate_audio, undefined);
    assert.equal(input.seed, 42);
    assert.equal(supportedDuration(m, 3), '5');
    assert.equal(supportedDuration(m, 5), '5');
    assert.equal(supportedDuration(m, 14), '14');
    assert.throws(() => supportedDuration(m, 16), /cannot cover/);
    if (image) {
      assert.equal(input.image_url, 'asset:first');
      assert.equal(input.end_image_url, 'asset:last');
      assert.equal(input.aspect_ratio, undefined);
      assert.throws(() => buildInput(m, 'test'), /image url/);
    } else assert.equal(input.aspect_ratio, '9:16');
    assert.throws(() => buildInput(m, 'test', {...refs, duration: 4}), /requires/);
    assert.throws(() => buildInput(m, 'test', {...refs, resolution: '720p'}), /resolution/);
    const launch = estimate(m, input, Date.parse('2026-09-24'));
    const standard = estimate(m, input, Date.parse('2026-10-01'));
    assert.equal(standard, launch * 2);
    assert.equal(launch, m.id.includes('turbo') ? 0.0625 : 0.125);
  }
  assert.ok(!recommendModels({inputs:[{kind:'audio'}]}).some(m => m.id.startsWith('minimax/h3-max') && !m.id.endsWith('/reference-to-video')));
  assert.ok(recommendModels({inputs:[{kind:'audio'}]}).some(m => m.id.endsWith('/reference-to-video')));
  const reference = models.find((candidate) => candidate.id.endsWith('/reference-to-video'));
  const referenceInput = buildInput(reference, 'Use @Image1 and @Image2', { reference_image_urls: ['asset:one', 'asset:two'], duration: '5', aspect_ratio: '9:16' });
  assert.deepEqual(referenceInput.reference_image_urls, ['asset:one', 'asset:two']);
  assert.equal(referenceInput.image_urls, undefined);
  assert.equal(referenceInput.resolution, '768P');
  assert.equal(estimate(reference, referenceInput), 0.4);
  assert.ok(recommendModels({inputs:[{kind:'image'},{kind:'image'},{kind:'image'}]}).some(m => m.id === reference.id));
});
