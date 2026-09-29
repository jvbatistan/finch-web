import assert from 'node:assert/strict';
import test from 'node:test';
import { preflight } from './financial-smoke.mjs';

const valid = {
  FINCH_E2E_WEB_URL: 'http://127.0.0.1:3000',
  FINCH_E2E_API_URL: 'http://localhost:3001',
  API_URL: 'http://localhost:3001',
  FINCH_E2E_EMAIL_A: 'finch-e2e-a@example.test',
  FINCH_E2E_PASSWORD_A: 'synthetic-a',
  FINCH_E2E_EMAIL_B: 'finch-e2e-b@example.test',
  FINCH_E2E_PASSWORD_B: 'synthetic-b',
};

test('accepts isolated loopback targets and synthetic identities', () => {
  assert.equal(preflight(valid).web.origin, 'http://127.0.0.1:3000');
});

test('rejects overlapping Web and API origins or a mismatched proxy target', () => {
  assert.throws(() => preflight({ ...valid, FINCH_E2E_API_URL: valid.FINCH_E2E_WEB_URL }), /Preflight/);
  assert.throws(() => preflight({ ...valid, API_URL: valid.FINCH_E2E_WEB_URL }), /Preflight/);
});

test('rejects missing variables before browser startup', () => {
  for (const key of Object.keys(valid)) {
    const env = { ...valid };
    delete env[key];
    assert.throws(() => preflight(env), /Preflight/);
  }
});

test('rejects external URLs, URL credentials and non-synthetic identities', () => {
  for (const url of ['https://example.test', 'http://192.168.1.5:3000', 'http://user:pass@localhost:3000', 'http://localhost:3000/path']) {
    assert.throws(() => preflight({ ...valid, FINCH_E2E_WEB_URL: url }), /Preflight/);
    assert.throws(() => preflight({ ...valid, FINCH_E2E_API_URL: url }), /Preflight/);
  }
  assert.throws(() => preflight({ ...valid, FINCH_E2E_EMAIL_A: 'alice@gmail.com' }), /Preflight/);
  assert.throws(() => preflight({ ...valid, FINCH_E2E_EMAIL_A: 'alice@example.test' }), /Preflight/);
  assert.throws(() => preflight({ ...valid, FINCH_E2E_EMAIL_B: 'finch-e2e-@example.test' }), /Preflight/);
  assert.throws(() => preflight({ ...valid, FINCH_E2E_EMAIL_A: 'finch-e2e-A@example.test' }), /Preflight/);
  assert.throws(() => preflight({ ...valid, FINCH_E2E_EMAIL_B: valid.FINCH_E2E_EMAIL_A }), /Preflight/);
  assert.throws(() => preflight({ ...valid, API_URL: 'https://example.test' }), /Preflight/);
});

test('does not include credential values in failures', () => {
  assert.throws(() => preflight({ ...valid, FINCH_E2E_PASSWORD_A: '' }), (error) => {
    assert.doesNotMatch(error.message, /synthetic-b|finch-e2e-a@example/);
    return true;
  });
});
