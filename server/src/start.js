import { buildApp } from './app.js';
import { loadConfig } from './config.js';
import { closeDb } from './storage/db.js';

async function main() {
  const config = loadConfig();
  console.log(`Starting Couple Website Node Backend on port ${config.port}...`);

  const app = await buildApp();

  const shutdown = async (signal) => {
    console.log(`\nReceived ${signal}, shutting down gracefully...`);
    try {
      await app.close();
      closeDb();
      console.log('Cleanup complete. Goodbye!');
      process.exit(0);
    } catch (err) {
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));

  try {
    await app.listen({ port: config.port, host: config.host });
    console.log(`🚀 Server listening at http://${config.host}:${config.port}`);
  } catch (err) {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
}

main();
