/**
 * OpenAI Service
 *
 * Centralized OpenAI client configuration and helper methods
 */

import OpenAI from 'openai';

let openaiClient: OpenAI | null = null;

export function getOpenAI(): OpenAI {
  if (!openaiClient) {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      throw new Error('OPENAI_API_KEY environment variable is not set');
    }
    const baseURL = process.env.OPENAI_BASE_URL;
    openaiClient = new OpenAI({
      apiKey,
      ...(baseURL && { baseURL })
    });
  }
  return openaiClient;
}

/**
 * Parse JSON from AI response, handling markdown code blocks
 */
export function parseAIJson<T>(content: string): T {
  // Remove markdown code blocks if present
  let cleaned = content.trim();
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7);
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3);
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3);
  }
  return JSON.parse(cleaned.trim());
}

/**
 * Standard GPT-4o-mini request with JSON response
 */
export async function chatCompletionJson<T>(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<T> {
  const openai = getOpenAI();
  const { model = 'gpt-4o-mini', temperature = 0.3, maxTokens } = options;

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    response_format: { type: 'json_object' },
    ...(maxTokens && { max_tokens: maxTokens }),
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('Empty AI response');
  }

  return parseAIJson<T>(content);
}

/**
 * Standard GPT-4o-mini request with text response
 */
export async function chatCompletionText(
  prompt: string,
  options: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  } = {}
): Promise<string> {
  const openai = getOpenAI();
  const { model = 'gpt-4o-mini', temperature = 0.3, maxTokens } = options;

  const response = await openai.chat.completions.create({
    model,
    messages: [{ role: 'user', content: prompt }],
    temperature,
    ...(maxTokens && { max_tokens: maxTokens }),
  });

  const content = response.choices[0].message.content;
  if (!content) {
    throw new Error('Empty AI response');
  }

  return content;
}
