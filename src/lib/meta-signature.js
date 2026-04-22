import crypto from 'node:crypto';

import { env } from '../config/env.js';

function isValidMetaSignature(signature, rawBody) {
  if (!env.metaAppSecret) {
    return true;
  }

  if (!signature || !rawBody) {
    return false;
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', env.metaAppSecret)
    .update(rawBody)
    .digest('hex')}`;

  const signatureBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (signatureBuffer.length !== expectedBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
}

export { isValidMetaSignature };
