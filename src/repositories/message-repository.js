async function insertMessage(client, {
  userId,
  metaMessageId,
  direction,
  messageType,
  textBody,
  payload,
}) {
  const result = await client.query(
    `INSERT INTO messages (
       user_id,
       meta_message_id,
       direction,
       message_type,
       text_body,
       payload
     )
     VALUES ($1, $2, $3, $4, $5, $6::jsonb)
     ON CONFLICT (meta_message_id) DO NOTHING
     RETURNING id`,
    [
      userId,
      metaMessageId || null,
      direction,
      messageType,
      textBody,
      JSON.stringify(payload ?? {}),
    ],
  );

  return result.rowCount > 0;
}

export { insertMessage };
