import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';

export async function checkBudgetIncreases({ t, call, create, approve, users, dept, User, Department, Request, Payment, AuditLog, BudgetIncreaseRequest }) {
  const [employee, manager, director, accountant, hr, admin] = users;
  const route = '/finance/budget-increases';
  const submit = async (amount = 20_000_000, key = randomUUID(), actor = accountant, extra = {}) => {
    return call(actor, route, 'POST', { departmentId: String(dept._id), amount, reason: 'Additional equipment capacity', ...extra }, { 'Idempotency-Key': key });
  };
  const decide = (id, action = 'APPROVED', actor = director, reason = '') => call(actor, `${route}/${id}/decision`, 'PATCH', { action, reason });
  let first, other;
  await t.test('budget increases enforce scope, validation, immutable submissions and idempotent creation', async () => {
    const before = await Department.findById(dept._id).lean();
    for (const actor of [employee, manager, hr, admin]) {
      assert.equal((await call(actor, route)).status, 403);
      assert.equal((await submit(1, randomUUID(), actor)).status, 403);
      assert.equal((await decide(dept._id, 'APPROVED', actor)).status, 403);
    }
    assert.equal((await submit(1, randomUUID(), director)).status, 403);
    assert.equal((await decide(dept._id, 'APPROVED', accountant)).status, 403);
    for (const extra of [{ amount: 0 }, { amount: -1 }, { amount: 1.1 }, { amount: '1' }, { reason: '' }, { status: 'APPROVED' }, { departmentId: String(new User()._id) }]) {
      assert.ok([400,404].includes((await submit(1, randomUUID(), accountant, extra)).status));
    }
    const key = randomUUID(), original = await submit(20_000_000, key);
    assert.equal(original.status, 201); first = original.body.data.id;
    const replay = await submit(20_000_000, key);
    assert.equal(replay.status, 200); assert.equal(replay.body.data.id, first);
    assert.equal((await submit(21_000_000, key)).status, 409);
    const concurrentKey = randomUUID(), concurrent = await Promise.all([submit(1_000_000, concurrentKey), submit(1_000_000, concurrentKey)]);
    assert.deepEqual(concurrent.map(row => row.status).sort(), [200,201]);
    assert.equal(await BudgetIncreaseRequest.countDocuments({ createdBy: accountant._id, idempotencyKey: concurrentKey }), 1);
    other = await User.create({ name: 'Other accountant', email: 'other-accountant@finance.test', department: 'Finance Test', role: 'ACCOUNTANT', password: await bcrypt.hash(randomUUID(), 10) });
    assert.equal((await call(other, route)).body.data.total, 0);
    assert.equal((await call(other, `${route}/${first}`)).status, 404);
    assert.equal((await call(accountant, `${route}/${first}`)).body.data.status, 'PENDING');
    assert.equal((await call(director, `${route}/${first}`)).body.data.department.name, dept.name);
    assert.equal((await call(director, route + '?status=INVALID')).status, 400);
    assert.equal((await call(accountant, route + '?limit=101')).status, 400);
    const after = await Department.findById(dept._id).lean();
    assert.equal(after.annualBudget, before.annualBudget); assert.equal(after.usedBudget, before.usedBudget);
    assert.equal((await call(accountant, `/finance/budgets/${dept._id}`, 'PATCH', { allocatedAmount: before.annualBudget + 1, revision: before.budgetRevision || 0 })).status, 403);
    assert.equal(await AuditLog.countDocuments({ action: 'REQUEST_BUDGET_INCREASE', targetId: first }), 1);
  });
  await t.test('Director decisions increment once, rejection preserves budget, and audit failures roll back', async () => {
    const before = await Department.findById(dept._id).lean(), paymentCount = await Payment.countDocuments({});
    assert.equal((await decide(first)).status, 200);
    assert.equal((await decide(first)).status, 409);
    let budget = await Department.findById(dept._id).lean();
    assert.equal(budget.annualBudget, before.annualBudget + 20_000_000); assert.equal(budget.usedBudget, before.usedBudget);
    const rejected = (await submit()).body.data.id;
    assert.equal((await decide(rejected, 'REJECTED')).status, 400);
    assert.equal((await decide(rejected, 'REJECTED', director, 'Not required at present')).status, 200);
    assert.equal((await decide(rejected)).status, 409);
    assert.equal((await Department.findById(dept._id)).annualBudget, budget.annualBudget);
    const failed = (await submit()).body.data.id;
    const originalAudit = AuditLog.create;
    AuditLog.create = async () => { throw new Error('Isolated budget approval audit failure'); };
    try { assert.equal((await decide(failed)).status, 500); } finally { AuditLog.create = originalAudit; }
    assert.equal((await BudgetIncreaseRequest.findById(failed)).status, 'PENDING');
    assert.equal((await Department.findById(dept._id)).annualBudget, budget.annualBudget);
    const originalDepartment = Department.findOneAndUpdate;
    Department.findOneAndUpdate = async () => { throw new Error('Isolated budget write failure'); };
    try { assert.equal((await decide(failed)).status, 500); } finally { Department.findOneAndUpdate = originalDepartment; }
    assert.equal((await BudgetIncreaseRequest.findById(failed)).status, 'PENDING');
    const requestCount = await BudgetIncreaseRequest.countDocuments({});
    AuditLog.create = async () => { throw new Error('Isolated submission audit failure'); };
    try { assert.equal((await submit()).status, 500); } finally { AuditLog.create = originalAudit; }
    assert.equal(await BudgetIncreaseRequest.countDocuments({}), requestCount);
    const raced = (await submit(3_000_000)).body.data.id;
    const decisions = await Promise.all([decide(raced), decide(raced)]);
    assert.deepEqual(decisions.map(row => row.status).sort(), [200,409]);
    assert.equal(await AuditLog.countDocuments({ action: 'APPROVE_BUDGET_INCREASE', targetId: raced }), 1);
    const a = (await submit(6_000_000)).body.data.id, b = (await submit(7_000_000)).body.data.id;
    const two = await Promise.all([decide(a), decide(b)]); assert.ok(two.every(row => row.status === 200));
    assert.equal((await Department.findById(dept._id)).annualBudget, budget.annualBudget + 16_000_000);
    const own = (await submit(1_000_000, randomUUID(), other)).body.data.id;
    await User.updateOne({ _id: other._id }, { role: 'DIRECTOR' });
    try { assert.equal((await decide(own, 'APPROVED', other)).status, 403); } finally { await User.updateOne({ _id: other._id }, { role: 'ACCOUNTANT' }); }
    assert.equal(await Payment.countDocuments({}), paymentCount);
  });
  await t.test('budget increases coexist with purchase commitments and preserve the 49/50 million workflow', async () => {
    const purchase = await create(); await approve(manager, purchase);
    const addition = (await submit(5_000_000)).body.data.id;
    const before = await Department.findById(dept._id).lean();
    const results = await Promise.all([decide(addition), approve(accountant, purchase)]);
    assert.ok(results.every(row => row.status === 200), JSON.stringify(results));
    const after = await Department.findById(dept._id).lean();
    assert.equal(after.annualBudget, before.annualBudget + 5_000_000); assert.equal(after.usedBudget, before.usedBudget + 10_000_000);
    const low = await create(49_000_000); await approve(manager, low);
    assert.equal((await Request.findById(low)).status, 'PENDING_ACCOUNTANT'); assert.equal((await approve(accountant, low)).status, 200);
    const high = await create(50_000_000); await approve(manager, high);
    assert.equal((await Request.findById(high)).status, 'PENDING_DIRECTOR'); assert.equal((await approve(accountant, high)).status, 403);
    assert.equal((await approve(director, high)).status, 200); assert.equal((await approve(accountant, high)).status, 200);
    const purchases = [await create(), await create()]; for (const id of purchases) await approve(manager, id);
    const constrained = await Department.findById(dept._id).lean();
    await Department.updateOne({ _id: dept._id }, { annualBudget: constrained.usedBudget + 15_000_000 });
    const racing = await Promise.all(purchases.map(id => approve(accountant, id)));
    assert.deepEqual(racing.map(row => row.status).sort(), [200,400]);
    assert.equal((await Department.findById(dept._id)).usedBudget, constrained.usedBudget + 10_000_000);
  });
}
