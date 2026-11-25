import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { readTestConfig } from './support/mongoTestEnvironment.js';

export function runMongoFinanceTests({ readConfig = readTestConfig, run = spawnSync } = {}) {
  if (!readConfig()) throw new Error('Thiếu môi trường MongoDB test riêng. Điền backend/.env.test theo .env.test.example; không dùng URI Demo/Production.');
  const result = run(process.execPath, ['--test', fileURLToPath(new URL('./finance.mongo.test.js', import.meta.url))], {
    stdio: 'inherit', env: { ...process.env, FLOWREQUEST_REQUIRE_MONGO_TEST: 'true' },
  });
  return Number.isInteger(result.status) ? result.status : 1;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try { process.exitCode = runMongoFinanceTests(); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
