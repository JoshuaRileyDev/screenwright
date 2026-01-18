/**
 * Tests for ai/config.ts - AI Configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { getAIConfig, getOpenRouterApiKey, getElevenLabsApiKey, getModel, type AIConfig } from '../../src/ai/config.js';

// Store original env vars
const originalEnv = { ...process.env };

describe('getAIConfig', () => {
  afterEach(() => {
    // Restore env vars after each test
    process.env = { ...originalEnv };
  });

  it('should return empty config when no sources available', async () => {
    // Clear all env vars
    delete process.env.OPENROUTER_API_KEY;
    delete process.env.ELEVENLABS_API_KEY;

    const config = await getAIConfig();
    expect(config).toEqual({});
  });

  it('should prioritize environment variables', async () => {
    process.env.OPENROUTER_API_KEY = 'env-key-123';
    process.env.ELEVENLABS_API_KEY = 'env-labs-456';
    process.env.CONTENT_CREATOR_MODEL = 'env-model';

    // Mock loadOnboardConfig to return different values
    const config = await getAIConfig();

    expect(config.openrouterApiKey).toBe('env-key-123');
    expect(config.elevenlabsApiKey).toBe('env-labs-456');
    expect(config.contentCreatorModel).toBe('env-model');
  });

  it('should include model preferences from env vars', async () => {
    process.env.OPENROUTER_API_KEY = 'test-key';
    process.env.CONTENT_CREATOR_MODEL = 'anthropic/claude-sonnet-4.5';
    process.env.SCRIPTWRITER_MODEL = 'google/gemini-2.5-flash';
    process.env.PLANNER_MODEL = 'google/gemini-2.0-flash';

    const config = await getAIConfig();

    expect(config.contentCreatorModel).toBe('anthropic/claude-sonnet-4.5');
    expect(config.scriptwriterModel).toBe('google/gemini-2.5-flash');
    expect(config.plannerModel).toBe('google/gemini-2.0-flash');
  });
});

describe('getOpenRouterApiKey', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should return key from environment variable', async () => {
    process.env.OPENROUTER_API_KEY = 'test-or-key';

    const key = await getOpenRouterApiKey();
    expect(key).toBe('test-or-key');
  });

  it('should throw when no key is available', async () => {
    delete process.env.OPENROUTER_API_KEY;

    await expect(getOpenRouterApiKey()).rejects.toThrow('OpenRouter API key not found');
  });
});

describe('getElevenLabsApiKey', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('should return key from environment variable', async () => {
    process.env.ELEVENLABS_API_KEY = 'test-el-key';

    const key = await getElevenLabsApiKey();
    expect(key).toBe('test-el-key');
  });

  it('should throw when no key is available', async () => {
    delete process.env.ELEVENLABS_API_KEY;

    await expect(getElevenLabsApiKey()).rejects.toThrow('ElevenLabs API key not found');
  });
});

describe('getModel', () => {
  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('content-creator agent', () => {
    it('should use agent-specific model from config', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.CONTENT_CREATOR_MODEL = 'custom-creator-model';

      const model = await getModel('content-creator');
      expect(model).toBe('custom-creator-model');
    });

    it('should use default when no agent-specific model set', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const model = await getModel('content-creator');
      expect(model).toBe('anthropic/claude-sonnet-4.5');
    });

    it('should fall back to OPENROUTER_MODEL env var', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.OPENROUTER_MODEL = 'fallback-model';

      const model = await getModel('content-creator');
      expect(model).toBe('fallback-model');
    });
  });

  describe('scriptwriter agent', () => {
    it('should use agent-specific model from config', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.SCRIPTWRITER_MODEL = 'custom-script-model';

      const model = await getModel('scriptwriter');
      expect(model).toBe('custom-script-model');
    });

    it('should use default when no agent-specific model set', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const model = await getModel('scriptwriter');
      expect(model).toBe('google/gemini-2.5-flash');
    });
  });

  describe('planner agent', () => {
    it('should use agent-specific model from config', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.PLANNER_MODEL = 'custom-planner-model';

      const model = await getModel('planner');
      expect(model).toBe('custom-planner-model');
    });

    it('should use default when no agent-specific model set', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';

      const model = await getModel('planner');
      expect(model).toBe('google/gemini-2.5-flash');
    });
  });

  describe('model priority order', () => {
    it('should prioritize agent-specific env var over generic OPENROUTER_MODEL', async () => {
      process.env.OPENROUTER_API_KEY = 'test-key';
      process.env.OPENROUTER_MODEL = 'generic-model';
      process.env.CONTENT_CREATOR_MODEL = 'specific-model';

      const model = await getModel('content-creator');
      expect(model).toBe('specific-model');
    });
  });
});
