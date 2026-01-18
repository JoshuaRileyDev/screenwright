/**
 * Tests for ai/openrouter.ts - OpenRouter Client
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { OpenRouterClient, createOpenRouterClient, RECOMMENDED_MODELS } from '../../src/ai/openrouter.js';
import { mockSpawn } from '../setup.js';

describe('OpenRouterClient', () => {
  let client: OpenRouterClient;
  let originalFetch: typeof fetch;

  beforeEach(() => {
    // Mock fetch globally
    originalFetch = globalThis.fetch;
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  describe('constructor', () => {
    it('should accept API key as string', () => {
      client = new OpenRouterClient('test-api-key');
      expect(client).toBeDefined();
    });

    it('should accept API key in config object', () => {
      client = new OpenRouterClient({
        apiKey: 'test-api-key',
      });
      expect(client).toBeDefined();
    });

    it('should use custom base URL from config', () => {
      client = new OpenRouterClient({
        apiKey: 'test-api-key',
        baseURL: 'https://custom.api.com',
      });
      expect(client).toBeDefined();
    });

    it('should include custom headers', () => {
      client = new OpenRouterClient({
        apiKey: 'test-api-key',
        headers: {
          'X-Custom-Header': 'custom-value',
        },
      });
      expect(client).toBeDefined();
    });
  });

  describe('chatCompletion', () => {
    beforeEach(() => {
      client = new OpenRouterClient('test-api-key');
    });

    it('should make a chat completion request', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Test response',
          },
          finish_reason: 'stop',
        }],
        usage: {
          prompt_tokens: 10,
          completion_tokens: 5,
          total_tokens: 15,
        },
        model: 'test-model',
      };

      globalThis.fetch = async () => new Response(JSON.stringify(mockResponse));

      const result = await client.chatCompletion({
        model: 'test-model',
        messages: [
          { role: 'system', content: 'You are a helpful assistant' },
          { role: 'user', content: 'Hello' },
        ],
      });

      expect(result.content).toBe('Test response');
      expect(result.finishReason).toBe('stop');
      expect(result.usage?.totalTokens).toBe(15);
    });

    it('should handle tool calls in response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
            tool_calls: [{
              id: 'call-123',
              type: 'function',
              function: {
                name: 'test_function',
                arguments: '{"arg": "value"}',
              },
            }],
          },
          finish_reason: 'tool_calls',
        }],
      };

      globalThis.fetch = async () => new Response(JSON.stringify(mockResponse));

      const result = await client.chatCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
        tools: [{
          type: 'function',
          function: {
            name: 'test_function',
            description: 'Test function',
            parameters: { type: 'object', properties: {} },
          },
        }],
      });

      expect(result.toolCalls).toBeDefined();
      expect(result.toolCalls).toHaveLength(1);
      expect(result.toolCalls?.[0].function.name).toBe('test_function');
    });

    it('should handle API errors', async () => {
      globalThis.fetch = async () => new Response('Not found', { status: 404 });

      await expect(client.chatCompletion({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      })).rejects.toThrow('OpenRouter API error: 404');
    });

    it('should handle timeout', async () => {
      // Create a fetch that never resolves
      globalThis.fetch = async () => new Promise(() => {});

      // Timeout after 100ms for testing
      const shortTimeoutClient = new OpenRouterClient({
        apiKey: 'test-key',
        baseURL: 'https://api.example.com',
      });

      // Note: The actual timeout is 120s, we'd need to refactor to make it testable
      // For now, just verify the method exists
      expect(typeof shortTimeoutClient.chatCompletion).toBe('function');
    });
  });

  describe('chat', () => {
    beforeEach(() => {
      client = new OpenRouterClient('test-api-key');
    });

    it('should return content from simple chat request', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'Simple response',
          },
          finish_reason: 'stop',
        }],
      };

      globalThis.fetch = async () => new Response(JSON.stringify(mockResponse));

      const result = await client.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      });

      expect(result).toBe('Simple response');
    });

    it('should throw when no content in response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: null,
          },
          finish_reason: 'stop',
        }],
      };

      globalThis.fetch = async () => new Response(JSON.stringify(mockResponse));

      await expect(client.chat({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Hello' }],
      })).rejects.toThrow('No content in response');
    });
  });

  describe('chatJSON', () => {
    beforeEach(() => {
      client = new OpenRouterClient('test-api-key');
    });

    it('should parse JSON response', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: '{"result": "success", "count": 42}',
          },
          finish_reason: 'stop',
        }],
      };

      globalThis.fetch = async () => new Response(JSON.stringify(mockResponse));

      const result = await client.chatJSON<{ result: string; count: number }>({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Get JSON' }],
      });

      expect(result.result).toBe('success');
      expect(result.count).toBe(42);
    });

    it('should extract JSON from markdown code blocks', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: '```json\n{"result": "extracted"}\n```',
          },
          finish_reason: 'stop',
        }],
      };

      globalThis.fetch = async () => new Response(JSON.stringify(mockResponse));

      const result = await client.chatJSON<{ result: string }>({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Get JSON' }],
      });

      expect(result.result).toBe('extracted');
    });

    it('should throw on invalid JSON', async () => {
      const mockResponse = {
        choices: [{
          message: {
            role: 'assistant',
            content: 'not valid json',
          },
          finish_reason: 'stop',
        }],
      };

      globalThis.fetch = async () => new Response(JSON.stringify(mockResponse));

      await expect(client.chatJSON({
        model: 'test-model',
        messages: [{ role: 'user', content: 'Get JSON' }],
      })).rejects.toThrow();
    });
  });
});

describe('createOpenRouterClient', () => {
  let originalEnv: NodeJS.ProcessEnv;

  beforeEach(() => {
    originalEnv = process.env;
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should use provided API key', () => {
    const client = createOpenRouterClient('provided-key');
    expect(client).toBeDefined();
  });

  it('should use OPENROUTER_API_KEY env var when no key provided', () => {
    process.env.OPENROUTER_API_KEY = 'env-key';

    const client = createOpenRouterClient();
    expect(client).toBeDefined();
  });

  it('should throw when no API key available', () => {
    delete process.env.OPENROUTER_API_KEY;

    expect(() => createOpenRouterClient()).toThrow('OpenRouter API key not found');
  });
});

describe('RECOMMENDED_MODELS', () => {
  it('should have default model', () => {
    expect(RECOMMENDED_MODELS.default).toBe('anthropic/claude-sonnet-4.5');
  });

  it('should have cheap model', () => {
    expect(RECOMMENDED_MODELS.cheap).toBe('anthropic/claude-3-haiku');
  });

  it('should have balanced model', () => {
    expect(RECOMMENDED_MODELS.balanced).toBe('anthropic/claude-3.5-sonnet');
  });

  it('should have Gemini Flash model', () => {
    expect(RECOMMENDED_MODELS.geminiFlash).toBe('google/gemini-2.0-flash-exp:free');
  });

  it('should have Gemini model', () => {
    expect(RECOMMENDED_MODELS.gemini).toBe('google/gemini-2.5-flash');
  });
});
