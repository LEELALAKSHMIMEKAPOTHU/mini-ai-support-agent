import type { VercelRequest, VercelResponse } from '@vercel/node';
import prisma from './_lib/prisma';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    await prisma.$queryRaw`SELECT 1`;
    const hasKey = !!process.env.OPENAI_API_KEY;
    res.json({ ok: true, db: true, openaiKey: hasKey });
  } catch (err) {
    console.error('Health check error:', err);
    res.status(500).json({ ok: false });
  }
}
