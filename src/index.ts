import { SniperController } from './controller.js';

const controller = new SniperController();

controller.start().catch((err) => {
  console.error('[Main] Fatal pipeline error:', err);
  process.exit(1);
});

// Graceful termination handling
process.on('SIGINT', async () => {
  console.log('\nReceived SIGINT. Gracefully shutting down...');
  await controller.stop();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\nReceived SIGTERM. Gracefully shutting down...');
  await controller.stop();
  process.exit(0);
});
