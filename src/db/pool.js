import pg from 'pg';

import { env } from '../config/env.js';

const { Pool } = pg;

function resolveSslConfig() {
  if (env.databaseSslMode === 'disable') {
    return false;
  }

  return { rejectUnauthorized: false };
}

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: resolveSslConfig(),
});

export { pool };
