/**
 * AI Module - AI-powered agents for video creation
 *
 * This module provides AI-powered agents for:
 * - Content Creator: Generate tutorial video ideas from codebases
 * - Scriptwriter: Create voiceover scripts with precise timing
 * - Planner: Generate detailed recording plans by testing workflows
 *
 * @module ai
 */

// AI Config (env vars + onboard config)
export {
  getAIConfig,
  getOpenRouterApiKey,
  getElevenLabsApiKey,
  getModel,
  type AIConfig,
} from './config.js';

// OpenRouter client
export {
  OpenRouterClient,
  createOpenRouterClient,
  getModel as getOpenRouterModel,
  RECOMMENDED_MODELS,
  type ChatMessage,
  type Tool,
  type ChatCompletionOptions,
  type ChatCompletionResponse,
  type ChatCompletionResult,
  type OpenRouterConfig,
} from './openrouter.js';

// Prompts
export {
  CONTENT_CREATOR_SYSTEM_PROMPT,
} from './prompts/content-creator.js';
export {
  SCRIPTWRITER_SYSTEM_PROMPT,
  SCRIPTWRITER_USER_TEMPLATE,
} from './prompts/scriptwriter.js';
export {
  PLANNER_SYSTEM_PROMPT,
  PLANNER_USER_TEMPLATE,
} from './prompts/planner.js';

// Content Creator Agent
export {
  generateContentIdeas,
  type ContentIdea as AIContentIdea,
  type ContentCategory as AIContentCategory,
  type ExistingContent,
  type GenerateContentOptions as AIGenerateContentOptions,
} from './agents/content-creator.js';

// Scriptwriter Agent
export {
  generateScript,
  type TimestampedAction,
  type TimestampedActionSimple,
  type ScriptOutput,
  type ScriptWriterInput,
} from './agents/scriptwriter.js';

// Planner Agent Types
export {
  type UIElement,
  type ActionStep,
  type RecordingPlan,
  type PlannerInput,
  type MobileAutomation,
} from './agents/planner.js';

// Planner Agent Implementation
export {
  generateRecordingPlan,
} from './agents/planner-impl.js';
