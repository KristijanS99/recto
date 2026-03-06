import type { Config } from '../config.js';

export interface EnrichmentResult {
  title: string;
  tags: string[];
  mood: string | null;
  people: string[];
}

export interface LLMProvider {
  enrich(content: string): Promise<EnrichmentResult>;
  generate(prompt: string): Promise<string>;
}

const ENRICHMENT_PROMPT = `Given this journal entry, extract the following. Return ONLY valid JSON, no other text.

1. "title": A short title (max 10 words) capturing the essence
2. "tags": Array of 1-5 lowercase tags — topics, themes, activities
3. "mood": Single word mood (e.g., happy, frustrated, anxious, calm, excited, reflective) or null if unclear
4. "people": Array of people mentioned (first names or identifiers), empty array if none

Return JSON: { "title": "...", "tags": [...], "mood": "...", "people": [...] }`;

function parseEnrichmentResponse(text: string): EnrichmentResult {
  // Extract JSON from the response (handle markdown code blocks)
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('No JSON found in LLM response');
  }

  const parsed = JSON.parse(jsonMatch[0]) as Record<string, unknown>;

  return {
    title: typeof parsed.title === 'string' ? parsed.title : 'Untitled',
    tags: Array.isArray(parsed.tags)
      ? parsed.tags.filter((t): t is string => typeof t === 'string').map((t) => t.toLowerCase())
      : [],
    mood: typeof parsed.mood === 'string' ? parsed.mood.toLowerCase() : null,
    people: Array.isArray(parsed.people)
      ? parsed.people.filter((p): p is string => typeof p === 'string')
      : [],
  };
}

// ---------------------------------------------------------------------------
// Anthropic — Claude Haiku 4.5
// ---------------------------------------------------------------------------
export class AnthropicLLM implements LLMProvider {
  constructor(private apiKey: string) {}

  private async call(prompt: string, maxTokens = 512): Promise<string> {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': this.apiKey,
        'content-type': 'application/json',
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`Anthropic API failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      content: Array<{ type: string; text: string }>;
    };
    const textBlock = json.content.find((b) => b.type === 'text');
    if (!textBlock) throw new Error('No text block in Anthropic response');
    return textBlock.text;
  }

  async enrich(content: string): Promise<EnrichmentResult> {
    const text = await this.call(`${ENRICHMENT_PROMPT}\n\nJournal entry:\n${content}`);
    return parseEnrichmentResponse(text);
  }

  async generate(prompt: string): Promise<string> {
    return this.call(prompt, 1024);
  }
}

// ---------------------------------------------------------------------------
// OpenAI — GPT-4o-mini
// ---------------------------------------------------------------------------
export class OpenAILLM implements LLMProvider {
  constructor(private apiKey: string) {}

  private async call(
    userContent: string,
    systemContent?: string,
    maxTokens = 512,
    jsonMode = false,
  ): Promise<string> {
    const messages: Array<{ role: string; content: string }> = [];
    if (systemContent) messages.push({ role: 'system', content: systemContent });
    messages.push({ role: 'user', content: userContent });

    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: maxTokens,
        ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
        messages,
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      throw new Error(`OpenAI API failed (${res.status}): ${body}`);
    }

    const json = (await res.json()) as {
      choices: Array<{ message: { content: string } }>;
    };
    const message = json.choices[0]?.message?.content;
    if (!message) throw new Error('No content in OpenAI response');
    return message;
  }

  async enrich(content: string): Promise<EnrichmentResult> {
    const text = await this.call(content, ENRICHMENT_PROMPT, 512, true);
    return parseEnrichmentResponse(text);
  }

  async generate(prompt: string): Promise<string> {
    return this.call(prompt, undefined, 1024);
  }
}

// ---------------------------------------------------------------------------
// Null provider — used when LLM is disabled
// ---------------------------------------------------------------------------
export class NullLLM implements LLMProvider {
  async enrich(): Promise<EnrichmentResult> {
    return { title: '', tags: [], mood: null, people: [] };
  }

  async generate(): Promise<string> {
    return '';
  }
}

// ---------------------------------------------------------------------------
// Factory
// ---------------------------------------------------------------------------
export function createLLMProvider(config: Config): LLMProvider {
  switch (config.LLM_PROVIDER) {
    case 'anthropic':
      if (!config.ANTHROPIC_API_KEY)
        throw new Error('ANTHROPIC_API_KEY required for anthropic LLM');
      return new AnthropicLLM(config.ANTHROPIC_API_KEY);
    case 'openai':
      if (!config.OPENAI_API_KEY) throw new Error('OPENAI_API_KEY required for openai LLM');
      return new OpenAILLM(config.OPENAI_API_KEY);
    case 'none':
      return new NullLLM();
  }
}

// Exported for testing
export { parseEnrichmentResponse };
