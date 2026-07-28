// ── OmniRoute / OpenAI-compatible LLM adapter ────────────────────────────────
//
// Hard rule (ALICE build order): every LLM call in ALICE/ARIA goes through an
// OpenAI-compatible endpoint configured by OPENAI_BASE_URL (pointed at the
// user's OmniRoute instance) and OPENAI_API_KEY. We never call a provider URL
// directly and never hardcode a model name. Model selection order is:
//   process.env.ALICE_MODEL  →  "auto"  (OmniRoute's zero-config default)
//
// This module is the single choke point for provider-agnostic AI calls.

import OpenAI from "openai";

export interface ChatMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatCompleteOptions {
  /** Optional system prompt, prepended as a leading system message. */
  system?: string;
  /** Override the resolved model for a single call. Prefer ALICE_MODEL env. */
  model?: string;
  /** Max tokens for the completion. */
  maxTokens?: number;
  /** Sampling temperature. Defaults low for drafting determinism. */
  temperature?: number;
  /** AbortSignal for cancellation. */
  signal?: AbortSignal;
}

/**
 * Resolve the model to use. Never hardcode a provider model name — callers get
 * ALICE_MODEL if set, otherwise OmniRoute's zero-config "auto" router.
 */
export function getModel(): string {
  return process.env.ALICE_MODEL ?? "auto";
}

/**
 * Build an OpenAI SDK client pointed at OPENAI_BASE_URL. Reads the environment
 * on every call so configuration changes (and tests) take effect immediately.
 *
 * @throws if OPENAI_BASE_URL is not configured — ALICE refuses to guess a
 *         provider endpoint.
 */
export function getLlmClient(): OpenAI {
  const baseURL = process.env.OPENAI_BASE_URL;
  if (!baseURL) {
    throw new Error(
      "OPENAI_BASE_URL is not configured. Point it at your OmniRoute instance."
    );
  }
  // OpenAI SDK requires a non-empty apiKey string; OmniRoute may not check it,
  // but we still forward whatever the operator configured.
  const apiKey = process.env.OPENAI_API_KEY ?? "";
  return new OpenAI({ baseURL, apiKey });
}

/**
 * Provider-agnostic chat completion. Returns the assistant's text content.
 *
 * @throws if OPENAI_BASE_URL is unset (via getLlmClient), before any network
 *         call is attempted.
 */
export async function chatComplete(
  messages: ChatMessage[],
  opts: ChatCompleteOptions = {}
): Promise<string> {
  if (!Array.isArray(messages) || messages.length === 0) {
    throw new Error("chatComplete requires at least one message.");
  }
  const client = getLlmClient(); // throws a clear error if OPENAI_BASE_URL unset

  const finalMessages: ChatMessage[] = opts.system
    ? [{ role: "system", content: opts.system }, ...messages]
    : messages;

  const completion = await client.chat.completions.create(
    {
      model: opts.model ?? getModel(),
      messages: finalMessages,
      max_tokens: opts.maxTokens ?? 2048,
      temperature: opts.temperature ?? 0.2,
    },
    opts.signal ? { signal: opts.signal } : undefined
  );

  return completion.choices?.[0]?.message?.content ?? "";
}
