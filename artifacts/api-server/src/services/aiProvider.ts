import OpenAI from "openai";

export type ProviderId = "custom-openai" | "gemini" | "mistral" | "openrouter" | "groq";

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

async function completeOpenAiCompatible({
  apiKey,
  baseURL,
  model,
  system,
  user,
  maxTokens,
  maxTokensCap,
  jsonMode = true,
  defaultHeaders,
}: {
  apiKey: string;
  baseURL: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  maxTokensCap: number;
  jsonMode?: boolean;
  defaultHeaders?: Record<string, string>;
}) {
  const client = new OpenAI({ apiKey, baseURL, defaultHeaders });
  const res = await client.chat.completions.create({
    model,
    max_tokens: Math.min(maxTokens, maxTokensCap),
    messages: [
      { role: "system", content: system },
      { role: "user", content: user },
    ],
    ...(jsonMode ? { response_format: { type: "json_object" as const } } : {}),
  });
  return res.choices[0]?.message?.content ?? "{}";
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
    id: "mistral",
    name: "Mistral AI (Free/Eval)",
    model: process.env.MISTRAL_MODEL || "mistral-small-latest",
    type: "free",
    note: "Set MISTRAL_API_KEY - free/evaluation tier for prototyping",
    available: () => !!process.env.MISTRAL_API_KEY,
    complete: async (system, user, maxTokens) =>
      completeOpenAiCompatible({
        apiKey: process.env.MISTRAL_API_KEY!,
        baseURL: "https://api.mistral.ai/v1",
        model: process.env.MISTRAL_MODEL || "mistral-small-latest",
        system,
        user,
        maxTokens,
        maxTokensCap: 8192,
      }),
  },
  {
    id: "openrouter",
    name: "OpenRouter Free Model",
    model: process.env.OPENROUTER_MODEL || "Set OPENROUTER_MODEL",
    type: "free",
    note: "Set OPENROUTER_API_KEY and OPENROUTER_MODEL to any current :free model",
    available: () => !!process.env.OPENROUTER_API_KEY && !!process.env.OPENROUTER_MODEL,
    complete: async (system, user, maxTokens) =>
      completeOpenAiCompatible({
        apiKey: process.env.OPENROUTER_API_KEY!,
        baseURL: "https://openrouter.ai/api/v1",
        model: process.env.OPENROUTER_MODEL!,
        system,
        user,
        maxTokens,
        maxTokensCap: 6000,
        jsonMode: false,
        defaultHeaders: {
          "HTTP-Referer": process.env.PUBLIC_APP_URL || "https://pdf-mock-emulator.onrender.com",
          "X-Title": "Sarva Build PDF Mock Test",
        },
      }),
  },
  {
    id: "groq",
    name: "Groq - Llama 3.3 (Free)",
    model: "llama-3.3-70b-versatile",
    type: "free",
    note: "Set GROQ_API_KEY - free account at console.groq.com, very fast for smaller PDFs",
    available: () => !!process.env.GROQ_API_KEY,
    complete: async (system, user, maxTokens) => {
      return completeOpenAiCompatible({
        apiKey: process.env.GROQ_API_KEY!,
        baseURL: "https://api.groq.com/openai/v1",
        model: "llama-3.3-70b-versatile",
        system,
        user,
        maxTokens,
        maxTokensCap: 4096,
      });
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

export function getFallbackOrder(): ProviderStatus[] {
  return getProvidersStatus();
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
      "No AI provider is configured. Set at least one: GEMINI_API_KEY, GROQ_API_KEY, MISTRAL_API_KEY, OPENROUTER_API_KEY + OPENROUTER_MODEL, or OPENAI_API_KEY."
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
