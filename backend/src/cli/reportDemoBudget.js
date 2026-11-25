import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { MongoClient } from 'mongodb';
import { loadEnvironment } from '../config/environment.js';
import { inspectDatabase } from '../config/database.js';
import { approvalSnapshot, entityId } from '../services/FinanceService.js';

export function buildBudgetReview({ users, requests, departments, payments }) {
  const userById = new Map(users.map(row => [entityId(row), row]));
  const purchaseIds = new Set(requests.filter(row => row.type === 'PURCHASE').map(entityId));
  const paid = new Map();
  for (const payment of payments) paid.set(entityId(payment.request), (paid.get(entityId(payment.request)) || 0) + payment.amount);
  const pending = requests.filter(row => row.type === 'PURCHASE' && row.status === 'PENDING_ACCOUNTANT' && row.amount > 0);
  const pendingByDepartment = new Map();
  for (const row of pending) {
    const budget = departments.find(dept => row.department ? entityId(dept) === entityId(row.department) : dept.name === userById.get(entityId(row.author))?.department);
    const name = budget?.name || userById.get(entityId(row.author))?.department || null;
    const key = budget ? entityId(budget) : `unconfigured:${name}`;
    if (!pendingByDepartment.has(key)) pendingByDepartment.set(key, { department: name, budgetId: budget ? entityId(budget) : null, pendingCount: 0, pendingAmount: 0,
      availableAmount: Number.isSafeInteger(budget?.annualBudget) && Number.isSafeInteger(budget?.usedBudget) ? budget.annualBudget - budget.usedBudget : null });
    const group = pendingByDepartment.get(key); group.pendingCount++; group.pendingAmount += row.amount;
  }
  const pendingBudgetReview = [...pendingByDepartment.values()].map(group => ({ ...group,
    coversAllPending: Number.isSafeInteger(group.pendingAmount) && group.availableAmount !== null && group.availableAmount >= group.pendingAmount,
  }));
  const missingBudgetDepartments = [...new Set(pending.filter(row => !departments.some(dept => row.department ? entityId(dept) === entityId(row.department) : dept.name === userById.get(entityId(row.author))?.department)).map(row => userById.get(entityId(row.author))?.department || null))];
  const unlinked = requests.filter(row => row.type === 'PURCHASE' && row.status === 'APPROVED' && !row.department && !row.budgetDepartment).map(row => ({
    requestId: entityId(row), approvedAmount: approvalSnapshot(row).amount, paidAmount: paid.get(entityId(row)) || 0,
    currentAuthorDepartment: userById.get(entityId(row.author))?.department || null,
    historicalDepartmentMustBeConfirmed: true,
  }));
  const purchaseById = new Map(requests.filter(row => row.type === 'PURCHASE').map(row => [entityId(row), row]));
  const purchasePayments = payments.filter(row => purchaseIds.has(entityId(row.request)));
  const unassignedPaidAmount = purchasePayments.filter(row => !row.department).reduce((sum, row) => sum + row.amount, 0);
  const paymentDepartmentMismatches = purchasePayments.filter(row => {
    const request = purchaseById.get(entityId(row.request));
    return entityId(row.department) !== entityId(request.budgetDepartment || request.department);
  }).map(row => entityId(row.request));
  const counterMismatches = requests.filter(row => (row.paidAmount || 0) !== (paid.get(entityId(row)) || 0)).map(entityId);
  const invalidBudgets = departments.filter(row => !Number.isSafeInteger(row.annualBudget) || !Number.isSafeInteger(row.usedBudget) || row.usedBudget < 0 || row.annualBudget < row.usedBudget).map(entityId);
  return { readOnly: true, writes: 0, pendingAccountingPurchases: pending.length, missingBudgetDepartments,
    unassignedApprovedAmount: unlinked.reduce((sum, row) => sum + row.approvedAmount, 0),
    unassignedPaidAmount, paymentDepartmentMismatches,
    unlinkedApprovedPurchases: unlinked, paymentCounterMismatches: counterMismatches,
    pendingBudgetReview, invalidBudgets, ready: !missingBudgetDepartments.length && !unlinked.length && unassignedPaidAmount === 0 && !paymentDepartmentMismatches.length && !counterMismatches.length && !invalidBudgets.length && pendingBudgetReview.every(group => group.coversAllPending),
    decisionsRequired: missingBudgetDepartments.map(name => ({ department: name, allocatedAmount: null, openingCommittedAmount: null, requiresUserApproval: true })),
    note: 'Current author department is evidence for review, not authorization to reassign historical requests or payments. No data is changed.',
  };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let client;
  try {
    const config = loadEnvironment();
    if (config.environment !== 'demo') throw new Error();
    client = new MongoClient(config.mongoUri, { dbName: config.databaseName, serverSelectionTimeoutMS: 5000, maxPoolSize: 1 });
    await client.connect(); const db = client.db(config.databaseName); await inspectDatabase(db, 'demo');
    const names = ['users', 'requests', 'departments', 'requestpayments'];
    const counts = await Promise.all(names.map(name => db.collection(name).countDocuments({})));
    if (counts.some(count => count > 20000)) throw new Error();
    const [users, requests, departments, payments] = await Promise.all([
      db.collection('users').find({}, { projection: { department: 1 } }).toArray(),
      db.collection('requests').find({ type: 'PURCHASE' }).toArray(),
      db.collection('departments').find({}).toArray(),
      db.collection('requestpayments').find({}).toArray(),
    ]);
    const result = buildBudgetReview({ users, requests, departments, payments });
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ready ? 0 : 1;
  } catch { console.error('Không thể hoàn tất đối soát ngân sách Demo chỉ đọc. Kiểm tra kết nối/cấu hình; không có thay đổi dữ liệu.'); process.exitCode = 1; }
  finally { if (client) await client.close(); }
}
