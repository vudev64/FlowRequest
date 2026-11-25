import test from 'node:test';
import assert from 'node:assert/strict';
import { canHrProcess, HR_TYPES } from '../src/views/Hr_Admin/HRRequestData.js';

test('HR actions require correct role, stage, supported type and a different author', () => {
  const actor = { id: 'hr', role: 'hr_admin' };
  const request = { type: 'LEAVE', status: 'PENDING_HRADMIN', author: { _id: 'employee' } };
  for (const type of Object.keys(HR_TYPES)) assert.equal(canHrProcess({ ...request, type }, actor), true);
  assert.equal(canHrProcess({ ...request, type: 'PURCHASE' }, actor), false);
  for (const status of ['DRAFT', 'APPROVED', 'REJECTED', 'PENDING_MANAGER', 'PENDING_ACCOUNTANT']) assert.equal(canHrProcess({ ...request, status }, actor), false);
  assert.equal(canHrProcess({ ...request, author: { _id: 'hr' } }, actor), false);
  assert.equal(canHrProcess({ ...request, author: 'hr' }, actor), false);
  assert.equal(canHrProcess({ ...request, author: null }, actor), false);
  assert.equal(canHrProcess(request, { ...actor, role: 'MANAGER' }), false);
  assert.equal(canHrProcess(request, null), false);
});
