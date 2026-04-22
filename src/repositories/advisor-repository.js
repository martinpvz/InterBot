async function getActiveAdvisors(client) {
  const result = await client.query(
    `SELECT id, name, phone_number
     FROM advisors
     WHERE is_active = true
     ORDER BY priority ASC, id ASC`,
  );

  return result.rows;
}

async function getAndAdvanceAdvisorCursor(client, advisorsCount) {
  const existing = await client.query(
    `SELECT key, value_int
     FROM app_state
     WHERE key = 'advisor_round_robin'
     FOR UPDATE`,
  );

  if (existing.rowCount === 0) {
    await client.query(
      `INSERT INTO app_state (key, value_int)
       VALUES ('advisor_round_robin', 1)`,
    );

    return 0;
  }

  const current = existing.rows[0].value_int ?? 0;
  const next = (current + 1) % advisorsCount;

  await client.query(
    `UPDATE app_state
     SET value_int = $2,
         updated_at = NOW()
     WHERE key = $1`,
    ['advisor_round_robin', next],
  );

  return current % advisorsCount;
}

async function insertHandoff(client, {
  userId,
  advisorId,
  branch,
  stepLabel,
}) {
  await client.query(
    `INSERT INTO handoffs (user_id, advisor_id, branch, step_label, status)
     VALUES ($1, $2, $3, $4, 'pending')`,
    [userId, advisorId, branch, stepLabel],
  );
}

export { getActiveAdvisors, getAndAdvanceAdvisorCursor, insertHandoff };
