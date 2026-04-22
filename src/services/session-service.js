import { pool } from '../db/pool.js';
import { findOrCreateUser } from '../repositories/user-repository.js';
import {
  defaultSession,
  getSessionByUserId,
  saveSessionState,
} from '../repositories/session-repository.js';

async function loadSessionContext(phoneNumber) {
  const client = await pool.connect();

  try {
    const user = await findOrCreateUser(client, phoneNumber);
    const session = await getSessionByUserId(client, user.id);

    return {
      user,
      sessionId: session.id,
      state: { ...defaultSession, ...(session.state ?? {}) },
    };
  } finally {
    client.release();
  }
}

async function persistSessionState(sessionId, state) {
  const client = await pool.connect();

  try {
    await saveSessionState(client, sessionId, state);
  } finally {
    client.release();
  }
}

export { loadSessionContext, persistSessionState };
