const defaultSession = {
  rama: null,
  paso: 'inicio',
  ramaLabel: '',
  pasoLabel: '',
  identificationAttempted: false,
  identificationStep: null,
  identificationContext: null,
  customerProfile: null,
};

async function getSessionByUserId(client, userId) {
  const result = await client.query(
    `INSERT INTO sessions (user_id, state, is_active)
     VALUES ($1, $2::jsonb, true)
     ON CONFLICT (user_id)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, state`,
    [userId, JSON.stringify(defaultSession)],
  );

  return {
    id: result.rows[0].id,
    state: result.rows[0].state ?? defaultSession,
  };
}

async function saveSessionState(client, sessionId, state) {
  await client.query(
    `UPDATE sessions
     SET state = $2::jsonb,
         updated_at = NOW()
     WHERE id = $1`,
    [sessionId, JSON.stringify(state)],
  );
}

export { defaultSession, getSessionByUserId, saveSessionState };
