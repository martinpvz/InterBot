import express from 'express';

import { env } from '../config/env.js';
import { processIncomingText } from '../flows/chatbot-flow.js';
import { asyncHandler } from '../lib/async-handler.js';
import { HttpError } from '../lib/http-error.js';
import { logger } from '../lib/logger.js';
import { isValidMetaSignature } from '../lib/meta-signature.js';
import { recordInboundMessage } from '../services/message-service.js';
import { loadSessionContext, persistSessionState } from '../services/session-service.js';
import { extractIncomingMessage } from '../services/webhook-service.js';

const webhookRouter = express.Router();

webhookRouter.get('/', (req, res) => {
  if (
    req.query['hub.mode'] === 'subscribe' &&
    req.query['hub.verify_token'] === env.verifyToken
  ) {
    logger.info('Webhook verificado');
    return res.status(200).send(req.query['hub.challenge']);
  }

  return res.sendStatus(403);
});

webhookRouter.post('/', asyncHandler(async (req, res) => {
  const signature = req.get('x-hub-signature-256');

  if (!isValidMetaSignature(signature, req.rawBody)) {
    throw new HttpError(401, 'Firma del webhook invalida');
  }

  const incoming = extractIncomingMessage(req.body);

  if (!incoming) {
    return res.sendStatus(200);
  }

  const inboundResult = await recordInboundMessage({
    phoneNumber: incoming.phoneNumber,
    metaMessageId: incoming.metaMessageId,
    messageType: incoming.messageType,
    textBody: incoming.text,
    payload: incoming.payload,
  });

  if (!inboundResult.inserted) {
    logger.warn('Mensaje duplicado ignorado', { metaMessageId: incoming.metaMessageId });
    return res.sendStatus(200);
  }

  const sessionContext = await loadSessionContext(incoming.phoneNumber);

  logger.info('Mensaje recibido', {
    from: incoming.phoneNumber,
    text: incoming.text,
    metaMessageId: incoming.metaMessageId,
  });

  const updatedState = await processIncomingText({
    phoneNumber: incoming.phoneNumber,
    userId: inboundResult.user.id,
    state: sessionContext.state,
    text: incoming.text,
  });

  await persistSessionState(sessionContext.sessionId, updatedState);

  return res.sendStatus(200);
}));

export { webhookRouter };
