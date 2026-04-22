async function findOrCreateUser(client, phoneNumber) {
  const result = await client.query(
    `INSERT INTO users (phone_number)
     VALUES ($1)
     ON CONFLICT (phone_number)
     DO UPDATE SET updated_at = NOW()
     RETURNING id, phone_number`,
    [phoneNumber],
  );

  return result.rows[0];
}

export { findOrCreateUser };
