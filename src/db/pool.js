import pg from 'pg';

import { env } from '../config/env.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.databaseUrl,
  ssl: env.nodeEnv === 'development'
    ? false
    : { rejectUnauthorized: false },
});

export { pool };
