import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBudgetReview } from '../src/cli/reportDemoBudget.js';

test('read-only budget review exposes missing budgets and preserves historical payments without inventing balances', () => {
  const fixture = { users: [{ _id: 'author', department: 'Engineering' }], departments: [],
    requests: [{ _id: 'pending', type: 'PURCHASE', status: 'PENDING_ACCOUNTANT', amount: 50_000_000, author: 'author' },
      { _id: 'historical', type: 'PURCHASE', status: 'APPROVED', amount: 52_000_000, approvedAmount: 52_000_000, paidAmount: 52_000_000, author: 'author' }],
    payments: [{ request: 'historical', amount: 52_000_000, department: null }, { request: 'training', amount: 99, department: null }] };
  const before = structuredClone(fixture), result = buildBudgetReview(fixture);
  assert.equal(result.ready, false); assert.equal(result.writes, 0); assert.deepEqual(fixture, before);
  assert.deepEqual(result.missingBudgetDepartments, ['Engineering']);
  assert.equal(result.pendingBudgetReview[0].pendingAmount, 50_000_000); assert.equal(result.pendingBudgetReview[0].coversAllPending, false);
  assert.equal(result.unassignedApprovedAmount, 52_000_000); assert.equal(result.unassignedPaidAmount, 52_000_000);
  assert.equal(result.unlinkedApprovedPurchases[0].historicalDepartmentMustBeConfirmed, true);
  assert.equal(result.decisionsRequired[0].allocatedAmount, null); assert.equal(result.decisionsRequired[0].openingCommittedAmount, null);
});

test('review checks existing department references and payment-counter consistency', () => {
  const data = { users: [{ _id: 'author', department: 'Renamed' }], departments: [{ _id: 'budget', name: 'Original', annualBudget: 100, usedBudget: 0 }],
    requests: [{ _id: 'pending', author: 'author', type: 'PURCHASE', status: 'PENDING_ACCOUNTANT', amount: 10, department: 'budget' }], payments: [] };
  assert.equal(buildBudgetReview(data).ready, true);
  data.requests[0].paidAmount = 1;
  assert.equal(buildBudgetReview(data).ready, false);
  assert.deepEqual(buildBudgetReview(data).paymentCounterMismatches, ['pending']);
});

test('budget review does not claim readiness when individually affordable pending purchases exceed the shared budget', () => {
  const fixture = { users: [{ _id: 'author', department: 'IT' }], departments: [{ _id: 'budget', name: 'IT', annualBudget: 100, usedBudget: 10 }],
    requests: [1, 2].map(id => ({ _id: String(id), author: 'author', type: 'PURCHASE', status: 'PENDING_ACCOUNTANT', amount: 60, department: 'budget' })), payments: [] };
  const before = structuredClone(fixture), result = buildBudgetReview(fixture);
  assert.equal(result.ready, false); assert.equal(result.pendingBudgetReview[0].pendingAmount, 120); assert.equal(result.pendingBudgetReview[0].availableAmount, 90);
  assert.equal(result.pendingBudgetReview[0].coversAllPending, false); assert.deepEqual(fixture, before);
});

test('historical payment reconciliation requires matching request and payment departments, without changing either record', () => {
  const fixture = {
    users: [{ _id: 'author', department: 'IT' }],
    departments: [{ _id: 'it', name: 'IT', annualBudget: 100_000_000, usedBudget: 52_000_000 }],
    requests: [{ _id: 'historical', author: 'author', type: 'PURCHASE', status: 'APPROVED', amount: 52_000_000, approvedAmount: 52_000_000, paidAmount: 52_000_000, department: 'it', budgetDepartment: 'it' }],
    payments: [{ request: 'historical', amount: 52_000_000, department: null }],
  };
  const before = structuredClone(fixture), unassigned = buildBudgetReview(fixture);
  assert.equal(unassigned.ready, false);
  assert.equal(unassigned.unassignedPaidAmount, 52_000_000);
  assert.deepEqual(unassigned.paymentDepartmentMismatches, ['historical']);
  assert.deepEqual(fixture, before);
  fixture.payments[0].department = 'another-department';
  const mismatched = buildBudgetReview(fixture);
  assert.equal(mismatched.unassignedPaidAmount, 0);
  assert.equal(mismatched.ready, false);
  assert.deepEqual(mismatched.paymentDepartmentMismatches, ['historical']);
  fixture.payments[0].department = 'it';
  const reconciled = buildBudgetReview(fixture);
  assert.equal(reconciled.ready, true);
  assert.deepEqual(reconciled.paymentDepartmentMismatches, []);
});
