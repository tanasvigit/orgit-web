/**
 * Match socket/REST messages to the active route conversation id.
 * Handles `direct_<userId>` routes vs UUID `conversation_id` from the server.
 */
export function messageMatchesConversation(
  message: {
    conversation_id?: string;
    legacy_conversation_id?: string;
  },
  routeConversationId: string,
  resolvedConversationId?: string | null
): boolean {
  const messageConversationId = message?.conversation_id;
  if (!messageConversationId || !routeConversationId) return false;

  if (messageConversationId === routeConversationId) return true;

  if (resolvedConversationId && messageConversationId === resolvedConversationId) {
    return true;
  }

  if (message.legacy_conversation_id === routeConversationId) return true;

  if (
    resolvedConversationId &&
    routeConversationId.startsWith('direct_') &&
    messageConversationId === resolvedConversationId
  ) {
    return true;
  }

  return false;
}

export function conversationListMatchesMessage(
  conv: { id?: string; conversationId?: string },
  message: { conversation_id?: string; legacy_conversation_id?: string }
): boolean {
  const convId = String(conv.id || conv.conversationId || '').trim();
  const mid = String(message.conversation_id || '').trim();
  if (!convId || !mid) return false;
  if (convId === mid) return true;
  if (message.legacy_conversation_id && convId === message.legacy_conversation_id) return true;
  return false;
}
