import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `
You are a helpful support agent for "GadgetStore", a small e-commerce store. 
Answer clearly and concisely.

Here is some information about the store:
- Shipping Policy: We ship worldwide. Shipping to USA is free for orders over $50. Otherwise, it's $5 flat rate. International shipping is $15.
- Return Policy: You can return items within 30 days of purchase if they are unused and in original packaging.
- Support Hours: Mon-Fri 9am-5pm EST.
- Contact: support@gadgetstore.com

If you don't know the answer, politely say you don't know and offer to connect them to a human agent via email.
`;

export async function generateReply(
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
): Promise<string> {
  try {
    if (!process.env.OPENAI_API_KEY) {
        return "I'm sorry, I'm not configured correctly (Missing API Key).";
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.7,
    });

    return completion.choices[0].message.content || "I'm sorry, I couldn't generate a response.";
  } catch (error) {
    console.error('LLM Error:', error);
    return "I'm currently experiencing technical difficulties. Please try again later.";
  }
}
