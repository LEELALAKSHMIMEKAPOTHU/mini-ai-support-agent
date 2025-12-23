import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../_lib/prisma';
import { generateReply } from '../../src/llm';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  try {
    const { message, sessionId } = req.body || {};
    if (!message || typeof message !== 'string' || message.trim().length === 0) {
      return res.status(400).json({ error: 'Message cannot be empty' });
    }

    const MAX_LEN = 2000;
    const wasTruncated = message.length > MAX_LEN;
    const processedMessage = wasTruncated ? message.slice(0, MAX_LEN) : message;
    let currentSessionId = sessionId as string | undefined | null;

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

    await prisma.message.create({
      data: {
        content: message,
        sender: 'user',
        conversationId: currentSessionId!,
      },
    });

    const history = await prisma.message.findMany({
      where: { conversationId: currentSessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });

    const contextMessages = history
      .slice(1)
      .reverse()
      .map((msg: any) => ({ role: msg.sender === 'user' ? 'user' : 'assistant', content: msg.content }));

    const reply = await generateReply(contextMessages, processedMessage);
    const finalReply = wasTruncated ? `${reply}\n\nNote: Your message was very long, so I processed the first ${MAX_LEN} characters.` : reply;

    await prisma.message.create({
      data: {
        content: finalReply,
        sender: 'ai',
        conversationId: currentSessionId!,
      },
    });

    res.json({ reply: finalReply, sessionId: currentSessionId });
  } catch (error) {
    console.error('API /chat/message error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
}
