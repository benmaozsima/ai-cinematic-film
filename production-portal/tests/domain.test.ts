import assert from 'node:assert/strict';
// Node's native TypeScript runner needs the .ts suffix; keep this test out of
// the application's bundler resolution rules.
// @ts-expect-error TS5097: executed directly by Node with native TS stripping.
import {
  assertIdempotencyKey,
  assertStatusTransition,
  canTransitionStatus,
  isApprovalUsable,
  type PaidApprovalSnapshot,
} from '../db/domain.ts';

const expectThrows = (fn: () => unknown, message: string) => {
  assert.throws(fn, new RegExp(message));
};

// A retry of the same persisted state is safe; illegal backwards jumps are not.
assert.equal(canTransitionStatus('run', 'queued', 'queued'), true);
assert.equal(canTransitionStatus('run', 'queued', 'submitted'), true);
assert.equal(canTransitionStatus('run', 'succeeded', 'running'), false);
assert.equal(canTransitionStatus('job', 'failed', 'queued'), true);
assert.equal(canTransitionStatus('asset', 'approved', 'draft'), false);
assertStatusTransition('run', 'running', 'succeeded');
expectThrows(() => assertStatusTransition('run', 'succeeded', 'queued'), 'Invalid run status transition');

// Keys can safely be persisted/indexed and are stable across a client retry.
assertIdempotencyKey('shot-S003-image-v5');
expectThrows(() => assertIdempotencyKey('short'), '8-200');
expectThrows(() => assertIdempotencyKey('bad key value'), '8-200');

const baseApproval: PaidApprovalSnapshot = {
  quoteId: 'quote-1',
  quotePayloadHash: 'sha256:abc',
  provider: 'fal',
  model: 'flux',
  maxCostUsd: '0.04',
  expiresAt: '2030-01-01T00:00:00.000Z',
  requestedOperation: 'generate_image',
};
assert.equal(isApprovalUsable(baseApproval, new Date('2029-12-31T00:00:00.000Z')), true);
assert.equal(isApprovalUsable(baseApproval, new Date('2030-01-01T00:00:00.000Z')), false);
assert.equal(isApprovalUsable({ ...baseApproval, quotePayloadHash: '' }, new Date('2029-12-31T00:00:00.000Z')), false);

console.log('domain contract tests: ok');
