import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from '../../_lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const { sessionId } = req.query;
    if (!sessionId || typeof sessionId !== 'string') return res.status(400).json({ error: 'Missing sessionId' });

    const messages = await prisma.message.findMany({ where: { conversationId: sessionId }, orderBy: { createdAt: 'asc' } });
    res.json({ messages });
  } catch (error) {
    console.error('API /chat/history error:', error);
    res.status(500).json({ error: 'Failed to fetch history' });
  }
}
