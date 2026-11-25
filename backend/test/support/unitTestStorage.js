// Import before application routers/upload middleware in file-writing unit suites.
import { after } from 'node:test';
import path from 'node:path';
import { backendRoot, validateTestConfig, protectedTestConfigs, createTestStorage, cleanupTestStorage } from './mongoTestEnvironment.js';

const config = validateTestConfig({
  FINANCE_TEST_URI: 'mongodb://offline-fixture:not-a-real-password@offline.invalid/frft_unit',
  FINANCE_TEST_DB_NAME: 'frft_unit',
  FINANCE_TEST_STORAGE_ROOT: path.resolve(backendRoot, 'test-artifacts', 'unit-storage'),
}, protectedTestConfigs());
// Synchronous initialization is intentional: sibling static imports must see this
// override before upload.js captures its storage roots at module evaluation.
const storage = createTestStorage(config);
const previous = process.env.DEMO_STORAGE_ROOT;
process.env.DEMO_STORAGE_ROOT = storage.root;
export const testStorageRoot = storage.root;

after(async () => {
  try { await cleanupTestStorage(storage); }
  finally {
    if (previous === undefined) delete process.env.DEMO_STORAGE_ROOT;
    else process.env.DEMO_STORAGE_ROOT = previous;
  }
});
