import app from './app.js';
import { port } from './config/index.js';
import { disconnectDatabase } from './services/database.js';

const server = app.listen(port, () => {
  console.log(`KrishiSetu backend listening on http://localhost:${port}`);
});

const shutdown = async (): Promise<void> => {
  server.close(async () => {
    await disconnectDatabase();
    process.exit(0);
  });
};

process.once('SIGINT', shutdown);
process.once('SIGTERM', shutdown);
