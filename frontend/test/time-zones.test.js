import test from 'node:test';
import assert from 'node:assert/strict';
import { isValidTimeZone, matchingTimeZones, supportedTimeZones } from '../src/lib/timeZones.js';

test('time zone picker retains saved aliases and UTC while exposing the runtime catalogue', () => {
  const zones = supportedTimeZones('Asia/Ho_Chi_Minh');
  assert.ok(zones.includes('Asia/Ho_Chi_Minh'));
  assert.ok(zones.includes('UTC'));
  assert.ok(zones.includes('Asia/Tokyo'));
  assert.ok(zones.includes('America/New_York'));
  assert.equal(new Set(zones).size, zones.length);
  assert.ok(zones.every(isValidTimeZone));
  assert.ok(matchingTimeZones(zones, 'tokyo').includes('Asia/Tokyo'));
  assert.ok(matchingTimeZones(zones, 'new york').includes('America/New_York'));
  assert.deepEqual(matchingTimeZones(zones, 'Invalid/Missing'), []);
});

test('older browser fallback keeps saved selection and accepts valid manually entered IANA aliases', () => {
  const zones = supportedTimeZones('Asia/Bangkok', { DateTimeFormat: () => ({ resolvedOptions: () => ({ timeZone: 'UTC' }) }) });
  assert.deepEqual(zones, ['Asia/Bangkok', 'UTC']);
  assert.ok(matchingTimeZones(zones, 'Asia/Ho_Chi_Minh').includes('Asia/Ho_Chi_Minh'));
  assert.ok(matchingTimeZones(zones, 'Europe/London').includes('Europe/London'));
  assert.deepEqual(matchingTimeZones(zones, ''), zones);
  assert.equal(isValidTimeZone(''), false);
  assert.equal(isValidTimeZone('fake-zone'), false);
});
