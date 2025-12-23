import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../_lib/prisma';
import { generateReply } from '../../src/llm';

// NOTE: Vercel serverless functions may not support long-lived SSE connections reliably.
// This endpoint returns a non-streaming response (full reply) so the frontend's fallback logic will work.

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const message = typeof req.query.message === 'string' ? req.query.message : '';
    const incomingSessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;

    if (!message.trim()) return res.status(400).end();

    let currentSessionId = incomingSessionId || null;

    if (!currentSessionId) {
      const conversation = await prisma.conversation.create({ data: {} });
      currentSessionId = conversation.id;
    } else {
      const exists = await prisma.conversation.findUnique({ where: { id: currentSessionId } });
      if (!exists) {
        const conversation = await prisma.conversation.create({ data: {} });
        currentSessionId = conversation.id;
      }
    }

    await prisma.message.create({ data: { content: message, sender: 'user', conversationId: currentSessionId! } });

    const history = await prisma.message.findMany({ where: { conversationId: currentSessionId }, orderBy: { createdAt: 'desc' }, take: 10 });

    const contextMessages = history
      .slice(1)
      .reverse()
      .map((msg: any) => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.content }));

    const reply = await generateReply(contextMessages, message);

    const finalReply = reply || "I'm sorry, I couldn't generate a response.";

    await prisma.message.create({ data: { content: finalReply, sender: 'ai', conversationId: currentSessionId! } });

    // Return standard JSON — frontend will fallback to POST /chat/message if EventSource fails.
    res.json({ reply: finalReply, sessionId: currentSessionId });
  } catch (error) {
    console.error('API /chat/stream error:', error);
    res.status(500).json({ error: 'Stream failed' });
  }
}
