import { test } from 'vitest';
import assert from 'node:assert/strict';

// Direct rule implementations matching pb/migrations/collections.json semantics.
const rules = {
  usersList: (ctx) => ctx.id === ctx.authId,
  gameStateList: (ctx) => ctx.user === ctx.authId,
  scoresCreate: (ctx) => ctx.authId !== '' && ctx.user === ctx.authId,
};

test('users collection: user can read own record', () => {
  assert.strictEqual(rules.usersList({ authId: 'user_a', id: 'user_a' }), true);
});

test('users collection: user cannot read another record', () => {
  assert.strictEqual(rules.usersList({ authId: 'user_a', id: 'user_b' }), false);
});

test('game_state: owner can list own state', () => {
  assert.strictEqual(rules.gameStateList({ authId: 'user_a', user: 'user_a' }), true);
});

test('game_state: other user cannot list state', () => {
  assert.strictEqual(rules.gameStateList({ authId: 'user_a', user: 'user_b' }), false);
});

test('scores create: authenticated user can only post as self', () => {
  assert.strictEqual(rules.scoresCreate({ authId: 'user_a', user: 'user_a' }), true);
  assert.strictEqual(rules.scoresCreate({ authId: 'user_a', user: 'user_b' }), false);
  assert.strictEqual(rules.scoresCreate({ authId: '', user: 'user_a' }), false);
});
