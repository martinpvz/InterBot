function extractIncomingMessage(body) {
  const entry = body.entry?.[0]?.changes?.[0]?.value;
  const message = entry?.messages?.[0];

  if (!message) {
    return null;
  }

  let text = '';
  let messageType = message.type;

  if (message.type === 'text') {
    text = message.text?.body?.trim() ?? '';
  } else if (message.type === 'interactive') {
    if (message.interactive?.type === 'list_reply') {
      text = message.interactive.list_reply.id;
      messageType = 'interactive_list_reply';
    } else if (message.interactive?.type === 'button_reply') {
      text = message.interactive.button_reply.id;
      messageType = 'interactive_button_reply';
    }
  }

  if (!text) {
    return null;
  }

  return {
    phoneNumber: message.from,
    metaMessageId: message.id,
    text,
    messageType,
    payload: message,
  };
}

export { extractIncomingMessage };
