import OpenAI from "openai";

export type ProviderId = "custom-openai" | "groq" | "gemini";

export interface ProviderStatus {
  id: ProviderId;
  name: string;
  available: boolean;
  model: string;
  type: "paid" | "free";
  note: string;
}

interface Provider {
  id: ProviderId;
  name: string;
  model: string;
  type: "paid" | "free";
  note: string;
  available: () => boolean;
  complete: (system: string, user: string, maxTokens: number) => Promise<string>;
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function shouldRetryProviderError(message: string) {
  return /429|500|502|503|504|rate limit|temporarily|high demand|unavailable/i.test(message);
}

const PROVIDERS: Provider[] = [
  {
    id: "custom-openai",
    name: "Your OpenAI Key (GPT-4o-mini)",
    model: "gpt-4o-mini",
    type: "paid",
    note: "Set OPENAI_API_KEY in your .env file",
    available: () => !!process.env.OPENAI_API_KEY,
    complete: async (system, user, maxTokens) => {
      const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const res = await client.chat.completions.create({
        model: "gpt-4o-mini",
        max_completion_tokens: maxTokens,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
      return res.choices[0]?.message?.content ?? "{}";
    },
  },
  {
    id: "gemini",
    name: "Google Gemini 2.5 Flash (Free)",
    model: "gemini-2.5-flash",
    type: "free",
    note: "Set GEMINI_API_KEY - free at aistudio.google.com/apikey, best for long PDFs",
    available: () => !!process.env.GEMINI_API_KEY,
    complete: async (system, user, maxTokens) => {
      const key = process.env.GEMINI_API_KEY!;
      const url = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent";
      const resp = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json", "x-goog-api-key": key },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: system }] },
          contents: [{ role: "user", parts: [{ text: user }] }],
          generationConfig: {
            responseMimeType: "application/json",
            maxOutputTokens: Math.min(maxTokens, 8192),
            thinkingConfig: { thinkingBudget: 0 },
          },
        }),
      });
      if (!resp.ok) {
        const errBody = await resp.text().catch(() => "");
        throw new Error(`Gemini API error ${resp.status}: ${errBody.slice(0, 200)}`);
      }
      type GeminiResponse = {
        candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
      };
      const data = (await resp.json()) as GeminiResponse;
      return data.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
    },
  },
  {
    id: "groq",
    name: "Groq - Llama 3.3 (Free)",
    model: "llama-3.3-70b-versatile",
    type: "free",
    note: "Set GROQ_API_KEY - free account at console.groq.com, very fast for smaller PDFs",
    available: () => !!process.env.GROQ_API_KEY,
    complete: async (system, user, maxTokens) => {
      const client = new OpenAI({
        apiKey: process.env.GROQ_API_KEY,
        baseURL: "https://api.groq.com/openai/v1",
      });
      const res = await client.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        max_tokens: Math.min(maxTokens, 4096),
        messages: [
          { role: "system", content: system },
          { role: "user", content: user },
        ],
        response_format: { type: "json_object" },
      });
      return res.choices[0]?.message?.content ?? "{}";
    },
  },
];

export function getProvidersStatus(): ProviderStatus[] {
  return PROVIDERS.map((p) => ({
    id: p.id,
    name: p.name,
    available: p.available(),
    model: p.model,
    type: p.type,
    note: p.note,
  }));
}

export function getActiveProvider(): ProviderStatus | null {
  const statuses = getProvidersStatus();
  return statuses.find((s) => s.available) ?? null;
}

export async function aiComplete(
  systemPrompt: string,
  userPrompt: string,
  maxTokens = 8192,
  preferredProvider?: string
): Promise<{ content: string; provider: string; providerName: string }> {
  let available = PROVIDERS.filter((p) => p.available());

  if (available.length === 0) {
    throw new Error(
      "No AI provider is configured. Set at least one: OPENAI_API_KEY, GROQ_API_KEY, or GEMINI_API_KEY in your .env file or environment."
    );
  }

  if (preferredProvider) {
    const preferred = available.find((p) => p.id === preferredProvider);
    if (preferred) {
      available = [preferred, ...available.filter((p) => p.id !== preferredProvider)];
    }
  }

  const errors: string[] = [];
  for (const provider of available) {
    const maxAttempts = provider.id === "gemini" ? 3 : 1;
    let lastError = "";

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const content = await provider.complete(systemPrompt, userPrompt, maxTokens);
        return { content, provider: provider.id, providerName: provider.name };
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        lastError = msg;

        if (attempt < maxAttempts && shouldRetryProviderError(msg)) {
          await sleep(1000 * attempt);
          continue;
        }

        break;
      }
    }

    errors.push(`[${provider.name}] ${lastError}`);
  }

  throw new Error(
    `All AI providers failed. Errors:\n${errors.join("\n")}\n\nCheck your API keys and network connectivity.`
  );
}
