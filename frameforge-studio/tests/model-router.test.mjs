import { test } from 'node:test';
import assert from 'node:assert/strict';
import { inputManifest, recommendModels } from '../server/model-router.mjs';

test('model router maps mixed external references to compatible inputs', () => {
  const manifest = inputManifest([{ id: 'i', kind: 'image', role: 'identity' }, { id: 'v', kind: 'video', role: 'performance' }, { id: 'a', kind: 'audio', role: 'dialogue' }]);
  assert.deepEqual(manifest.kinds, ['image', 'video', 'audio']);
  const result = recommendModels({ task: 'lipsync', inputs: manifest.items, language: 'he' });
  assert.equal(result.length, 0); // lipsync requires a picture + one audio path, not an unrelated performance video
  const video = recommendModels({ task: 'video', inputs: [{ kind: 'image', role: 'identity' }], language: 'he' });
  assert.ok(video.some((model) => model.acceptedInputs.includes('start_image_url')));
});

test('router avoids models that cannot carry every attached reference', () => {
  const inputs = Array.from({ length: 3 }, (_, index) => ({ id: `image-${index}`, kind: 'image', role: 'identity' }));
  const video = recommendModels({ task: 'video', inputs, language: 'he', duration: 5 });
  assert.equal(video[0].id, 'bytedance/seedance-2.5/reference-to-video');
  assert.ok(!video.some((model) => model.id === 'fal-ai/kling-video/v2.6/pro/image-to-video'));
});

test('router chooses a runnable text-to-video path when no picture is attached', () => {
  const video = recommendModels({ task: 'video', inputs: [], language: 'he', duration: 5 });
  assert.ok(video.every((model) => !/image-to-video|reference-to-video|wan3_prime/.test(model.id)));
});

test('router exposes only runnable edit, dialogue and lipsync recipes', () => {
  const imagesWithoutSource = recommendModels({ task: 'image', inputs: [] });
  assert.ok(imagesWithoutSource.every((model) => !model.acceptedInputs.some((field) => ['image_url', 'image_urls'].includes(field))));
  const dialogue = recommendModels({ task: 'dialogue', inputs: [], language: 'en' });
  assert.deepEqual(dialogue.map((model) => model.id), ['fal-ai/elevenlabs/tts/eleven-v3']);
  assert.equal(recommendModels({ task: 'lipsync', inputs: [{ kind: 'audio' }] }).length, 0);
  assert.ok(recommendModels({ task: 'lipsync', inputs: [{ kind: 'video' }, { kind: 'audio' }] }).some((model) => model.task === 'Lip-sync'));
});
