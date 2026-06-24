import 'dotenv/config';

export const MONKEY_MESSAGES = [
  {
    role: 'system',
    content: 'You are an infinity of monkeys at typewriters'
  },
  {
    role: 'user',
    content: 'Write something'
  }
];

const FORBIDDEN_PROMPT_TERMS = /shakespeare|shakespear|\bbard\b|hamlet|macbeth|othello|lear|juliet|romeo|elizabethan|gutenberg/i;

export function assertPromptIsClean(messages = MONKEY_MESSAGES) {
  for (const message of messages) {
    if (FORBIDDEN_PROMPT_TERMS.test(message.content)) {
      throw new Error(`Prompt must not mention the benchmark corpus: ${message.role}`);
    }
  }
}

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required.`);
  }
  return value;
}

export async function askTheMonkeys() {
  assertPromptIsClean();

  const endpoint = requiredEnv('LLM_ENDPOINT');
  const apiKey = requiredEnv('LLM_API_KEY');
  const model = requiredEnv('LLM_MODEL');

  const res = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model,
      messages: MONKEY_MESSAGES,
      temperature: 1
    })
  });

  const raw = await res.text();

  if (!res.ok) {
    throw new Error(`LLM request failed: ${res.status} ${res.statusText}\n${raw}`);
  }

  let json;
  try {
    json = JSON.parse(raw);
  } catch {
    throw new Error(`LLM returned non-JSON response:\n${raw}`);
  }

  const text = json?.choices?.[0]?.message?.content;

  if (typeof text !== 'string' || text.trim().length === 0) {
    throw new Error(`LLM returned no text:\n${raw}`);
  }

  return { text: text.trim(), raw };
}
