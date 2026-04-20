const { Pool } = require('pg');
const {
  DATABASE_URL,
  DATABASE_URL_DIRECT,
  DB_SSL,
  DB_CONNECT_TIMEOUT_MS,
} = require('./env');

function getConnectionString() {
  return DATABASE_URL_DIRECT || DATABASE_URL;
}

function shouldUseSsl(connectionString) {
  if (!DB_SSL) return false;

  try {
    const parsed = new URL(connectionString);
    return !['localhost', '127.0.0.1'].includes(parsed.hostname);
  } catch (_err) {
    return DB_SSL;
  }
}

const connectionString = getConnectionString();
const missingDbError = new Error(
  'DATABASE_URL is not set. Configure DATABASE_URL (or DATABASE_URL_DIRECT) in .env.'
);

const disabledPool = {
  query: async () => {
    throw missingDbError;
  },
  connect: async () => {
    throw missingDbError;
  },
  end: async () => undefined,
  on: () => undefined,
};

const pool = connectionString
  ? new Pool({
      connectionString,
      connectionTimeoutMillis: DB_CONNECT_TIMEOUT_MS,
      idleTimeoutMillis: 30000,
      ...(shouldUseSsl(connectionString) ? { ssl: { rejectUnauthorized: false } } : {}),
    })
  : disabledPool;

if (pool !== disabledPool) {
  pool.on('error', (err) => {
    console.error('Unexpected database client error:', err.message);
  });
}

async function checkDbConnection() {
  try {
    await pool.query('SELECT 1 as ok');
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      code: err.code || 'DB_ERROR',
      message: err.message,
    };
  }
}

module.exports = {
  ...pool,
  checkDbConnection,
};
