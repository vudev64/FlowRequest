import test from 'node:test';
import assert from 'node:assert/strict';
import { setSystemConfiguration, systemTimeZone, passwordMeetsPolicy } from '../src/lib/systemConfiguration.js';
test('company timezone and password hints follow current configuration', () => {
  setSystemConfiguration({ general: { timeZone: 'America/New_York' } });
  assert.equal(systemTimeZone(), 'America/New_York');
  const policy = { minLength: 12, uppercase: true, lowercase: true, number: true, special: true };
  assert.equal(passwordMeetsPolicy('password', policy), false);
  assert.equal(passwordMeetsPolicy('StrongPass1!', policy), true);
  assert.equal(passwordMeetsPolicy('é'.repeat(40), { minLength: 8 }), false);
  setSystemConfiguration(null);
});
