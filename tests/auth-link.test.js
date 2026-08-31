import test from 'node:test';
import assert from 'node:assert/strict';
import { authModeFromLocationHash } from '../src/lib/auth-link.js';

test('Invitación y recuperación abren creación de contraseña sin aceptar otros enlaces', () => {
  assert.equal(authModeFromLocationHash('#access_token=ficticio&type=invite'), 'reset');
  assert.equal(authModeFromLocationHash('#type=recovery&access_token=ficticio'), 'reset');
  assert.equal(authModeFromLocationHash('#type=magiclink'), 'login');
  assert.equal(authModeFromLocationHash(''), 'login');
});
