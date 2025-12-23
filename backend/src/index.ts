import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { generateReply } from './llm';
import { z } from 'zod';

dotenv.config();

const app = express();
// Pass URL explicitly due to Prisma 7 changes regarding schema file
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
});
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Validation schema
const messageSchema = z.object({
  message: z.string().min(1, "Message cannot be empty"),
  sessionId: z.string().optional(),
});

app.post('/chat/message', async (req, res): Promise<void> => {
  try {
    const validation = messageSchema.safeParse(req.body);
    
    if (!validation.success) {
       res.status(400).json({ error: validation.error.issues[0].message });
       return;
    }

    const { message, sessionId } = validation.data;
    const MAX_LEN = 2000;
    const wasTruncated = message.length > MAX_LEN;
    const processedMessage = wasTruncated ? message.slice(0, MAX_LEN) : message;
    let currentSessionId = sessionId;

    // Create session if not exists
    if (!currentSessionId) {
      const conversation = await prisma.conversation.create({ data: {} });
      currentSessionId = conversation.id;
    } else {
        // Verify session exists
        const exists = await prisma.conversation.findUnique({ where: { id: currentSessionId }});
        if (!exists) {
             const conversation = await prisma.conversation.create({ data: {} });
             currentSessionId = conversation.id;
        }
    }

    // Save user message
    await prisma.message.create({
      data: {
        content: message,
        sender: 'user',
        conversationId: currentSessionId!,
      },
    });

    // Fetch history for context (limit to last 10 messages)
    const history = await prisma.message.findMany({
      where: { conversationId: currentSessionId },
      orderBy: { createdAt: 'desc' },
      take: 10,
    });
    
    // Prepare context for LLM (exclude the current message which is the first in the reversed list)
    // History from DB is desc (newest first). 
    // [CurrentMsg, PrevMsg1, PrevMsg2, ...]
    // We want to pass [PrevMsg2, PrevMsg1] as history to LLM
    
    const contextMessages = history
        .slice(1) // skip the first one (which is the current message)
        .reverse() // now in chronological order
        .map((msg: { sender: string; content: string }) => ({
            role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
            content: msg.content
        }));

    // Generate Reply
    const reply = await generateReply(contextMessages, processedMessage);
    const finalReply = wasTruncated
      ? `${reply}\n\nNote: Your message was very long, so I processed the first ${MAX_LEN} characters.`
      : reply;

    // Save AI reply
    await prisma.message.create({
      data: {
        content: finalReply,
        sender: 'ai',
        conversationId: currentSessionId!,
      },
    });

    res.json({ reply: finalReply, sessionId: currentSessionId });

  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/chat/history/:sessionId', async (req, res) => {
    try {
        const { sessionId } = req.params;
        const messages = await prisma.message.findMany({
            where: { conversationId: sessionId },
            orderBy: { createdAt: 'asc' }
        });
        res.json({ messages });
    } catch (error) {
        res.status(500).json({ error: 'Failed to fetch history' });
    }
});

app.get('/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const hasKey = !!process.env.OPENAI_API_KEY;
    res.json({ ok: true, db: true, openaiKey: hasKey });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.get('/chat/stream', async (req, res) => {
  try {
    const message = typeof req.query.message === 'string' ? req.query.message : '';
    const incomingSessionId = typeof req.query.sessionId === 'string' ? req.query.sessionId : undefined;

    if (!message.trim()) {
      res.status(400).end();
      return;
    }

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    const heartbeat = setInterval(() => {
      try {
        res.write(`: heartbeat\n\n`);
        res.write(`event: ping\ndata: ${Date.now()}\n\n`);
      } catch {
        clearInterval(heartbeat);
      }
    }, 15000);

    let currentSessionId = incomingSessionId || null;

    if (!currentSessionId) {
      const conversation = await prisma.conversation.create({ data: {} });
      currentSessionId = conversation.id;
    } else {
      const exists = await prisma.conversation.findUnique({ where: { id: currentSessionId }});
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
      .map((msg: { sender: string; content: string }) => ({
        role: msg.sender === 'user' ? 'user' as const : 'assistant' as const,
        content: msg.content,
      }));

    const MAX_LEN = 2000;
    const wasTruncated = message.length > MAX_LEN;
    const processedMessage = wasTruncated ? message.slice(0, MAX_LEN) : message;

    if (!process.env.OPENAI_API_KEY) {
      res.write(`data: ${JSON.stringify("I'm not configured correctly (Missing API Key).")}\n\n`);
      res.write(`event: end\ndata: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);
      clearInterval(heartbeat);
      res.end();
      return;
    }

    const stream = await require('openai').default.prototype.chat.completions.create.call(
      new (require('openai').default)({ apiKey: process.env.OPENAI_API_KEY }),
      {
        model: 'gpt-3.5-turbo',
        messages: [
          { role: 'system', content: `You are a helpful support agent for "GadgetStore". Answer clearly and concisely.\n- Shipping: USA free over $50; $5 otherwise; international $15.\n- Returns: 30 days if unused and in original packaging.\n- Support Hours: Mon-Fri 9am-5pm EST.\n- Contact: support@gadgetstore.com` },
          ...contextMessages,
          { role: 'user', content: processedMessage },
        ],
        max_tokens: 150,
        temperature: 0.7,
        stream: true,
      }
    );

    let fullText = '';
    for await (const part of stream) {
      const chunk = part.choices?.[0]?.delta?.content || '';
      if (chunk) {
        fullText += chunk;
        res.write(`data: ${JSON.stringify(chunk)}\n\n`);
      }
    }

    const finalText = wasTruncated
      ? `${fullText}\n\nNote: Your message was very long, so I processed the first ${MAX_LEN} characters.`
      : fullText;

    await prisma.message.create({
      data: {
        content: finalText || "I'm sorry, I couldn't generate a response.",
        sender: 'ai',
        conversationId: currentSessionId!,
      },
    });

    res.write(`event: end\ndata: ${JSON.stringify({ sessionId: currentSessionId })}\n\n`);
    clearInterval(heartbeat);
    res.end();
  } catch (error) {
    res.write(`event: error\ndata: ${JSON.stringify({ error: 'Stream failed' })}\n\n`);
    res.end();
  }
});

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
