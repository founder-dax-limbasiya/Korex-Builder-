import Groq from 'groq-sdk';

let _client: Groq | null = null;
const getClient = () => {
  if (!_client) _client = new Groq({ apiKey: process.env.GROQ_API_KEY! });
  return _client;
};

const MODELS = [
  process.env.GROQ_MODEL       || 'deepseek-r1-distill-llama-70b',
  process.env.GROQ_FALLBACK    || 'llama-3.1-70b-versatile',
  process.env.GROQ_EMERGENCY   || 'llama3-8b-8192',
];

export async function generate(system: string, user: string): Promise<{ text: string; model: string; tokens: number }> {
  const groq = getClient();
  const maxTokens = parseInt(process.env.MAX_TOKENS || '7000');

  for (const model of MODELS) {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const res = await groq.chat.completions.create({
          model,
          max_tokens: maxTokens,
          temperature: 0.3,
          messages: [
            { role: 'system', content: system },
            { role: 'user', content: user },
          ],
        });
        return {
          text: res.choices[0]?.message?.content ?? '',
          model,
          tokens: res.usage?.total_tokens ?? 0,
        };
      } catch (err: unknown) {
        const msg = String(err).toLowerCase();
        if (msg.includes('429') || msg.includes('rate_limit')) {
          await sleep(1500 * attempt);
          continue;
        }
        break;
      }
    }
  }
  throw new Error('All AI models are busy. Please try again in 30 seconds.');
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
