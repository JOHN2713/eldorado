import test from 'node:test';
import assert from 'node:assert/strict';
import { apiUrl } from '../src/lib/api-url.js';

test('API requests stay same-origin by default and accept a configured HTTPS origin', () => {
  assert.equal(apiUrl('/api/public/config', ''), '/api/public/config');
  assert.equal(apiUrl('/api/staff/users', 'https://eldorado.example/'), 'https://eldorado.example/api/staff/users');
});