import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLlmClient, getModel, chatComplete } from "./llm.js";

describe("OmniRoute LLM adapter", () => {
  const saved = {
    base: process.env.OPENAI_BASE_URL,
    key: process.env.OPENAI_API_KEY,
    model: process.env.ALICE_MODEL,
  };

  beforeEach(() => {
    delete process.env.OPENAI_BASE_URL;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ALICE_MODEL;
  });

  afterEach(() => {
    // restore original environment
    if (saved.base === undefined) delete process.env.OPENAI_BASE_URL;
    else process.env.OPENAI_BASE_URL = saved.base;
    if (saved.key === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = saved.key;
    if (saved.model === undefined) delete process.env.ALICE_MODEL;
    else process.env.ALICE_MODEL = saved.model;
  });

  it("getLlmClient throws a clear error when OPENAI_BASE_URL is not set", () => {
    expect(() => getLlmClient()).toThrowError(/OPENAI_BASE_URL is not configured/);
  });

  it("chatComplete rejects with a clear error when OPENAI_BASE_URL is not set (no network call)", async () => {
    await expect(chatComplete([{ role: "user", content: "hi" }])).rejects.toThrow(
      /OPENAI_BASE_URL is not configured/
    );
  });

  it("getLlmClient reads OPENAI_BASE_URL from env", () => {
    process.env.OPENAI_BASE_URL = "http://localhost:20128/v1";
    process.env.OPENAI_API_KEY = "test";
    const client = getLlmClient();
    // OpenAI SDK normalizes baseURL (may strip a trailing slash); assert prefix.
    expect(client.baseURL).toContain("http://localhost:20128/v1");
  });

  it("getModel defaults to 'auto' and never hardcodes a provider model", () => {
    expect(getModel()).toBe("auto");
  });

  it("getModel honors ALICE_MODEL when set", () => {
    process.env.ALICE_MODEL = "my-pinned-model";
    expect(getModel()).toBe("my-pinned-model");
  });

  it("chatComplete requires at least one message", async () => {
    process.env.OPENAI_BASE_URL = "http://localhost:20128/v1";
    await expect(chatComplete([])).rejects.toThrow(/at least one message/);
  });
});
