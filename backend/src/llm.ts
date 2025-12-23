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
  } catch (error: any) {
    console.error('LLM Error:', error);
    // Fallback for Quota limits (429) or other API issues
    if (error?.status === 429 || error?.code === 'insufficient_quota' || error?.type === 'insufficient_quota') {
      return "I am currently operating in Demo Mode because the OpenAI API quota has been exceeded. \n\n(Simulated Response): Hello! I can help you with shipping, returns, and support hours. What would you like to know?";
    }
    return "I'm currently experiencing technical difficulties (OpenAI API Error). Please check the backend logs.";
  }
}

export async function* generateStream(
  history: { role: 'user' | 'assistant'; content: string }[],
  userMessage: string
): AsyncGenerator<string, void, unknown> {
  try {
    if (!process.env.OPENAI_API_KEY) {
      yield "I'm sorry, I'm not configured correctly (Missing API Key).";
      return;
    }

    const messages: OpenAI.Chat.Completions.ChatCompletionMessageParam[] = [
      { role: 'system', content: SYSTEM_PROMPT },
      ...history.map((msg) => ({
        role: msg.role === 'user' ? ('user' as const) : ('assistant' as const),
        content: msg.content,
      })),
      { role: 'user', content: userMessage },
    ];

    console.log('Attempting to fetch response from OpenAI...');
    const stream = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: messages,
      max_tokens: 150,
      temperature: 0.7,
      stream: true,
    });

    console.log('OpenAI stream started successfully.');
    for await (const part of stream) {
      const chunk = part.choices[0]?.delta?.content || '';
      if (chunk) yield chunk;
    }
  } catch (error: any) {
    console.error('LLM Stream Error:', error);
    
    // Check for Quota limits (429)
    if (error?.status === 429 || error?.code === 'insufficient_quota' || error?.type === 'insufficient_quota') {
      console.warn('OpenAI Quota Exceeded. Switching to Demo Mode.');
      
      let simulatedResponse = "Hello! I can help you with shipping, returns, and support hours. What would you like to know?";
      const lowerMsg = userMessage.toLowerCase();

      if (lowerMsg.includes('shipping') || lowerMsg.includes('ship') || lowerMsg.includes('delivery') || lowerMsg.includes('cost')) {
        simulatedResponse = "Shipping to the USA is free for orders over $50. Otherwise, it's a $5 flat rate. International shipping is $15.";
      } else if (lowerMsg.includes('return') || lowerMsg.includes('refund') || lowerMsg.includes('back')) {
        simulatedResponse = "You can return items within 30 days of purchase if they are unused and in original packaging.";
      } else if (lowerMsg.includes('hour') || lowerMsg.includes('open') || lowerMsg.includes('time')) {
        simulatedResponse = "Our support hours are Mon-Fri 9am-5pm EST.";
      } else if (lowerMsg.includes('contact') || lowerMsg.includes('email') || lowerMsg.includes('support')) {
        simulatedResponse = "You can contact us at support@gadgetstore.com.";
      } else if (lowerMsg.includes('hello') || lowerMsg.includes('hi')) {
        simulatedResponse = "Hello! How can I help you today?";
      }

      const fallback = `I am currently operating in Demo Mode because the OpenAI API quota has been exceeded. \n\n(Simulated Response): ${simulatedResponse}`;
      
      // Simulate streaming
      const words = fallback.split(' ');
      for (const word of words) {
        yield word + ' ';
        await new Promise(resolve => setTimeout(resolve, 50)); // Delay for effect
      }
      return;
    }
    yield "I'm currently experiencing technical difficulties (OpenAI API Error). Please check the backend logs.";
  }
}
