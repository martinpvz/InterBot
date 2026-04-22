import { env } from '../config/env.js';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { recordOutboundMessage } from './message-service.js';

const apiUrl = `https://graph.facebook.com/v19.0/${env.phoneNumberId}/messages`;

async function sendText({ to, userId, text }) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'text',
    text: { body: text },
  };

  await sendPayload({
    to,
    userId,
    messageType: 'text',
    textBody: text,
    payload,
  });
}

async function sendList({ to, userId, header, body, footer, sections }) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'list',
      header: { type: 'text', text: header },
      body: { text: body },
      footer: { text: footer },
      action: {
        button: 'Ver opciones',
        sections,
      },
    },
  };

  await sendPayload({
    to,
    userId,
    messageType: 'interactive_list',
    textBody: body,
    payload,
  });
}

async function sendButtons({ to, userId, body, footer, buttons }) {
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'interactive',
    interactive: {
      type: 'button',
      body: { text: body },
      footer: { text: footer },
      action: {
        buttons: buttons.map((button) => ({
          type: 'reply',
          reply: { id: button.id, title: button.title },
        })),
      },
    },
  };

  await sendPayload({
    to,
    userId,
    messageType: 'interactive_button',
    textBody: body,
    payload,
  });
}

async function sendPayload({ to, userId, messageType, textBody, payload }) {
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error('Error enviando mensaje a WhatsApp', { to, data });
    throw new HttpError(502, 'Error enviando mensaje a WhatsApp', data);
  }

  await recordOutboundMessage({
    userId,
    metaMessageId: data.messages?.[0]?.id ?? null,
    messageType,
    textBody,
    payload: { request: payload, response: data },
  });
}

export { sendButtons, sendList, sendText };
