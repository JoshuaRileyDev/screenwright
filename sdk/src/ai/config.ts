/**
 * AI Configuration
 *
 * Handles AI configuration from:
 * 1. Environment variables (for CI/CD, advanced users)
 * 2. Onboard config (for regular users)
 * 3. Direct config passing (for programmatic use)
 */

import { loadOnboardConfig, type OnboardConfig } from '../utils/onboard.js';

/**
 * AI Configuration options
 */
export interface AIConfig {
  openrouterApiKey?: string;
  elevenlabsApiKey?: string;
  // Model preferences
  contentCreatorModel?: string;
  scriptwriterModel?: string;
  plannerModel?: string;
}

/**
 * Get AI configuration from environment variables or onboard config
 *
 * Priority:
 * 1. Environment variables (highest priority - for CI/CD)
 * 2. Onboard config (for regular users)
 * 3. Defaults
 */
export async function getAIConfig(): Promise<AIConfig> {
  const config: AIConfig = {};

  // First, check environment variables
  const envOpenRouter = process.env.OPENROUTER_API_KEY?.trim();
  const envElevenLabs = process.env.ELEVENLABS_API_KEY?.trim();

  // Model preferences from env vars
  const envContentModel = process.env.CONTENT_CREATOR_MODEL?.trim();
  const envScriptModel = process.env.SCRIPTWRITER_MODEL?.trim();
  const envPlannerModel = process.env.PLANNER_MODEL?.trim();

  // If env vars are set, use them (highest priority)
  if (envOpenRouter) {
    config.openrouterApiKey = envOpenRouter;
  }
  if (envElevenLabs) {
    config.elevenlabsApiKey = envElevenLabs;
  }
  if (envContentModel) {
    config.contentCreatorModel = envContentModel;
  }
  if (envScriptModel) {
    config.scriptwriterModel = envScriptModel;
  }
  if (envPlannerModel) {
    config.plannerModel = envPlannerModel;
  }

  // If we already have the API key from env, don't load from config
  // This allows env vars to override onboard config (useful for CI/CD)
  if (!config.openrouterApiKey || !config.elevenlabsApiKey) {
    try {
      const onboardConfig = await loadOnboardConfig();
      if (onboardConfig) {
        if (!config.openrouterApiKey && onboardConfig.openrouterApiKey) {
          config.openrouterApiKey = onboardConfig.openrouterApiKey;
        }
        if (!config.elevenlabsApiKey && onboardConfig.elevenlabsApiKey) {
          config.elevenlabsApiKey = onboardConfig.elevenlabsApiKey;
        }
      }
    } catch {
      // If loading config fails, continue with env vars only
    }
  }

  return config;
}

/**
 * Get OpenRouter API key with error handling
 */
export async function getOpenRouterApiKey(): Promise<string> {
  const config = await getAIConfig();

  if (!config.openrouterApiKey) {
    throw new Error(
      'OpenRouter API key not found. Please run:\n' +
      '  "screenwright onboard" to configure your API keys, or\n' +
      '  Set the OPENROUTER_API_KEY environment variable.\n\n' +
      'Get your key at: https://openrouter.ai/keys'
    );
  }

  return config.openrouterApiKey;
}

/**
 * Get ElevenLabs API key with error handling
 */
export async function getElevenLabsApiKey(): Promise<string> {
  const config = await getAIConfig();

  if (!config.elevenlabsApiKey) {
    throw new Error(
      'ElevenLabs API key not found. Please run:\n' +
      '  "screenwright onboard" to configure your API keys, or\n' +
      '  Set the ELEVENLABS_API_KEY environment variable.\n\n' +
      'Get your key at: https://elevenlabs.io/app/settings/api-keys'
    );
  }

  return config.elevenlabsApiKey;
}

/**
 * Get model preference for a specific agent
 */
export async function getModel(agent: 'content-creator' | 'scriptwriter' | 'planner'): Promise<string> {
  const config = await getAIConfig();

  // Check for agent-specific model preference
  const agentModelKey = `${agent}Model` as keyof AIConfig;
  const agentModel = config[agentModelKey];

  if (agentModel) {
    return agentModel as string;
  }

  // Fall back to env var (for backward compatibility)
  const envVar = `OPENROUTER_MODEL`;
  const envModel = process.env[envVar]?.trim();
  if (envModel) {
    return envModel;
  }

  // Defaults
  const defaults: Record<typeof agent, string> = {
    'content-creator': 'anthropic/claude-sonnet-4.5',
    'scriptwriter': 'google/gemini-2.5-flash',
    'planner': 'google/gemini-2.5-flash',
  };

  return defaults[agent];
}
