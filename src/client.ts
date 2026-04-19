/**
 * Anthropic API wrapper with:
 *  - model preset selection (opus / sonnet / haiku)
 *  - structured-output parsing + validation retry
 *  - cost tracking returned alongside content
 */

import Anthropic from "@anthropic-ai/sdk";

export const MODELS = {
  opus: "claude-opus-4-6" as const,
  sonnet: "claude-sonnet-4-6" as const,
  haiku: "claude-haiku-4-5-20251001" as const,
};

export type ModelPreset = keyof typeof MODELS;

// Per-million-token pricing in USD. Update as Anthropic changes pricing.
const PRICING_PER_MTOK: Record<ModelPreset, { input: number; output: number }> = {
  opus:   { input: 15,  output: 75 },
  sonnet: { input: 3,   output: 15 },
  haiku:  { input: 0.80, output: 4 },
};

export interface LLMCallOptions {
  model: ModelPreset;
  system: string;
  user: string;
  maxTokens?: number;
  temperature?: number;
  /** when set, instructs the model to always begin with `{` and returns the parsed JSON directly */
  jsonMode?: boolean;
  /** extra validator to run on parsed JSON. Throw to reject; retries once with validator error in the user message. */
  validator?: (obj: unknown) => void;
}

export interface LLMCallResult<T = unknown> {
  content: T;
  raw_text: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  cost_usd: number;
  model_used: string;
  retries: number;
}

export interface ClientOptions {
  apiKey?: string;
  /** override per-call timeout in ms */
  timeoutMs?: number;
}

export function createClient(opts: ClientOptions = {}) {
  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY not set");
  const client = new Anthropic({ apiKey });

  async function call<T = unknown>(options: LLMCallOptions): Promise<LLMCallResult<T>> {
    const model = MODELS[options.model];
    const maxTokens = options.maxTokens ?? 8192;
    const temperature = options.temperature ?? 0.2;

    const assistantPrefill = options.jsonMode ? "{" : undefined;

    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: options.user },
    ];
    if (assistantPrefill !== undefined) {
      messages.push({ role: "assistant", content: assistantPrefill });
    }

    let retries = 0;
    let lastError: string | null = null;

    for (let attempt = 0; attempt < 2; attempt++) {
      if (lastError && attempt > 0) {
        // append a corrective user message for retry
        messages.push({ role: "user", content: `Your previous response failed JSON validation: ${lastError}. Return a corrected JSON object and nothing else.` });
      }

      const response = await client.messages.create({
        model,
        max_tokens: maxTokens,
        temperature,
        system: options.system,
        messages,
      }, { timeout: opts.timeoutMs });

      const textBlock = response.content.find((b) => b.type === "text");
      const rawText =
        (assistantPrefill ?? "") +
        (textBlock && textBlock.type === "text" ? textBlock.text : "");

      const usage = response.usage;
      const pricing = PRICING_PER_MTOK[options.model];
      const cost_usd =
        (usage.input_tokens * pricing.input + usage.output_tokens * pricing.output) /
        1_000_000;

      if (!options.jsonMode) {
        return {
          content: rawText as unknown as T,
          raw_text: rawText,
          stop_reason: response.stop_reason ?? "end_turn",
          usage: {
            input_tokens: usage.input_tokens,
            output_tokens: usage.output_tokens,
          },
          cost_usd,
          model_used: model,
          retries,
        };
      }

      // JSON mode: parse + validate
      let parsed: unknown;
      try {
        parsed = parseJsonLenient(rawText);
      } catch (e) {
        lastError = (e as Error).message;
        retries++;
        continue;
      }
      try {
        options.validator?.(parsed);
      } catch (e) {
        lastError = `validator: ${(e as Error).message}`;
        retries++;
        // add the model's last response to context so it can self-correct
        messages.push({ role: "assistant", content: rawText });
        continue;
      }
      return {
        content: parsed as T,
        raw_text: rawText,
        stop_reason: response.stop_reason ?? "end_turn",
        usage: {
          input_tokens: usage.input_tokens,
          output_tokens: usage.output_tokens,
        },
        cost_usd,
        model_used: model,
        retries,
      };
    }
    throw new Error(`LLM call failed after retries: ${lastError}`);
  }

  return { call };
}

// Tolerant JSON parser: strip code fences if present, then try JSON.parse.
function parseJsonLenient(text: string): unknown {
  let t = text.trim();
  // strip ``` fences
  if (t.startsWith("```")) {
    t = t.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
  }
  // find first { and last } to tolerate leading/trailing prose
  const first = t.indexOf("{");
  const last = t.lastIndexOf("}");
  if (first === -1 || last === -1 || last <= first) {
    throw new Error("no JSON object found in response");
  }
  const candidate = t.slice(first, last + 1);
  return JSON.parse(candidate);
}
