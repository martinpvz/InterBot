import { pool } from '../db/pool.js';
import { insertMessage } from '../repositories/message-repository.js';
import { findOrCreateUser } from '../repositories/user-repository.js';

async function recordInboundMessage({ phoneNumber, metaMessageId, messageType, textBody, payload }) {
  const client = await pool.connect();

  try {
    const user = await findOrCreateUser(client, phoneNumber);

    const inserted = await insertMessage(client, {
      userId: user.id,
      metaMessageId,
      direction: 'inbound',
      messageType,
      textBody,
      payload,
    });

    return { user, inserted };
  } finally {
    client.release();
  }
}

async function recordOutboundMessage({ userId, messageType, textBody, payload, metaMessageId = null }) {
  const client = await pool.connect();

  try {
    await insertMessage(client, {
      userId,
      metaMessageId,
      direction: 'outbound',
      messageType,
      textBody,
      payload,
    });
  } finally {
    client.release();
  }
}

export { recordInboundMessage, recordOutboundMessage };
