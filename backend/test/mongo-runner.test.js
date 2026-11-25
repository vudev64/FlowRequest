import test from 'node:test';
import assert from 'node:assert/strict';
import { runMongoFinanceTests } from './runFinanceMongo.js';

test('mandatory Mongo runner fails without isolated config and never starts a fallback connection', () => {
  let spawned = false;
  assert.throws(() => runMongoFinanceTests({ readConfig: () => null, run: () => { spawned = true; } }), /MongoDB test riêng/);
  assert.equal(spawned, false);
});

test('mandatory Mongo runner requires the real suite and propagates errors or interruption', () => {
  for (const status of [0, 1, null]) {
    const result = runMongoFinanceTests({ readConfig: () => ({ isolated: true }), run: (executable, args, options) => {
      assert.equal(executable, process.execPath); assert.equal(args[0], '--test'); assert.ok(args[1].endsWith('finance.mongo.test.js'));
      assert.equal(options.env.FLOWREQUEST_REQUIRE_MONGO_TEST, 'true');
      return { status };
    } });
    assert.equal(result, status === 0 ? 0 : 1);
  }
});
