import mongoose from 'mongoose';
import { runtimeConfig } from './environment.js';

export function assertDemoDatabasePrivileges(status, database) {
  const privileges = status.authInfo?.authenticatedUserPrivileges;
  if (!status.authInfo?.authenticatedUsers?.length || !Array.isArray(privileges) || !privileges.length ||
      privileges.some(p => p.resource?.db !== database || p.resource?.cluster || p.resource?.anyResource)) {
    throw new Error('Chưa thể deploy Demo: cần MongoDB user chỉ có quyền trên database Demo.');
  }
}

export async function inspectDatabase(db, environment, bootstrap = false) {
  const identity = await db.collection('runtimeenvironments').findOne({ _id: 'identity' });
  if (identity && identity.environment !== environment) throw new Error('Database đã thuộc môi trường khác.');
  if (environment === 'demo') {
    const testMarker = await db.collection('flowrequest_test_control').findOne({ _id: 'environment' });
    if (testMarker?.purpose === 'flowrequest-isolated-mongo-test') throw new Error('Database này thuộc môi trường kiểm thử. Không khởi chạy Demo trên dữ liệu test.');
  }
  if (environment === 'production' && !identity) {
    if (!bootstrap) throw new Error('Production chưa được khởi tạo. Chạy npm run bootstrap:production trước.');
    const collections = await db.listCollections({}, { nameOnly: true }).toArray();
    for (const item of collections) if (!item.name.startsWith('system.') && await db.collection(item.name).findOne({}, { projection: { _id: 1 } })) throw new Error('Không bootstrap Production vào database đã có dữ liệu hoặc dữ liệu Demo.');
  }
}
const connectDB = async (config = runtimeConfig(), { bootstrap = false } = {}) => {
  const client = new mongoose.mongo.MongoClient(config.mongoUri, { serverSelectionTimeoutMS: 10000, maxPoolSize: 2 });
  try {
    await client.connect();
    const db = client.db(config.databaseName);
    await inspectDatabase(db, config.environment, bootstrap);
    if (config.publicDemo) assertDemoDatabasePrivileges(await db.command({ connectionStatus: 1, showPrivileges: true }), config.databaseName);
  }
  finally { await client.close(); }
  await mongoose.connect(config.mongoUri, { dbName: config.databaseName, serverSelectionTimeoutMS: 10000 });
  console.log(`MongoDB đã kết nối môi trường ${config.environment}.`);
  return mongoose.connection;
};

export default connectDB;
