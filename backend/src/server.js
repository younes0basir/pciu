require('dotenv').config({ quiet: true });

const app = require('./app');
const {
  logError,
  logSuccess,
  logWarn,
  maskDatabaseUrl,
  printFatal,
  printShutdown,
  printStartupBanner,
} = require('./lib/cli');
const { verifyDatabase } = require('./lib/verifyDatabase');
const { syncAdminFromEnv } = require('./services/adminBootstrap');

const PORT = Number(process.env.PORT) || 3001;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DATABASE_URL = process.env.DATABASE_URL;
const baseUrl = `http://localhost:${PORT}`;

let server;

async function start() {
  printStartupBanner({
    port: PORT,
    nodeEnv: NODE_ENV,
    baseUrl,
    databaseHost: maskDatabaseUrl(DATABASE_URL),
  });

  if (!DATABASE_URL) {
    logWarn('DATABASE_URL is not set — API routes will fail until it is configured');
  } else {
    const database = await verifyDatabase(DATABASE_URL);
    if (database.ok) {
      logSuccess('Database connection verified');
      try {
        const adminSync = await syncAdminFromEnv();
        if (adminSync.synced) {
          logSuccess(`Admin account synced from environment (${adminSync.email})`);
        } else {
          logWarn('Admin bootstrap skipped — set ADMIN_EMAIL and ADMIN_PASSWORD to enable admin sign-in');
        }
      } catch (error) {
        logError(`Admin bootstrap failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    } else {
      logError(`Database connection failed: ${database.message}`);
    }
  }

  server = app.listen(PORT, () => {
    logSuccess(`Server ready on ${baseUrl}`);
  });

  server.on('error', (error) => {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'EADDRINUSE') {
      printFatal(new Error(`Port ${PORT} is already in use`));
      return;
    }
    printFatal(error);
  });
}

function shutdown(signal) {
  printShutdown(signal);

  if (!server) {
    process.exit(0);
    return;
  }

  server.close((error) => {
    if (error) {
      logError(error.message);
      process.exit(1);
      return;
    }
    logSuccess('Server stopped');
    process.exit(0);
  });
}

process.on('SIGINT', () => shutdown('SIGINT'));
process.on('SIGTERM', () => shutdown('SIGTERM'));

start().catch(printFatal);
