import { loadEnvironment } from './config/environment.js';
import connectDB from './config/database.js';

try {
  const config = loadEnvironment();
  await connectDB(config);
  const { createApp } = await import('./app.js');
  const server = createApp(config).listen(config.port, () => console.log(`FlowRequest ${config.environment} đang lắng nghe tại cổng ${config.port}.`));
  const shutdown = () => { server.close(async () => { const { default: mongoose } = await import('mongoose'); await mongoose.disconnect(); process.exit(0); }); };
  process.once('SIGTERM', shutdown); process.once('SIGINT', shutdown);
} catch (error) { console.error('Không thể khởi động FlowRequest:', error.message); process.exitCode = 1; }
