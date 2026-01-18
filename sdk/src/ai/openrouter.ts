/**
 * OpenRouter AI Provider
 * Provides unified API for multiple LLM providers via OpenRouter
 */

/**
 * Create an OpenRouter provider using OpenAI SDK
 * OpenRouter provides a unified API for many LLM providers
 *
 * Cheap models to consider:
 * - google/gemini-flash-1.5: Fast and cheap
 * - meta-llama/llama-3.1-8b-instruct:free: Free!
 * - mistralai/mistral-7b-instruct:free: Free!
 * - anthropic/claude-3-haiku: Fast and cheap
 */
export type OpenRouterConfig = string | {
  apiKey: string;
  baseURL?: string;
  headers?: Record<string, string>;
};

export interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
}

export interface ToolCall {
  id: string;
  type: 'function';
  function: {
    name: string;
    arguments: string;
  };
}

export interface Tool {
  type: 'function';
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}

export interface ChatCompletionOptions {
  model: string;
  messages: ChatMessage[];
  tools?: Tool[];
  tool_choice?: 'auto' | 'none';
  response_format?: { type: 'json_object' };
  temperature?: number;
  max_tokens?: number;
}

export interface ChatCompletionResponse {
  choices: Array<{
    message: {
      role: string;
      content?: string;
      tool_calls?: ToolCall[];
    };
    finish_reason: string;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
  model?: string;
}

export interface ChatCompletionResult {
  content?: string;
  toolCalls?: ToolCall[];
  finishReason: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  model?: string;
}

/**
 * OpenRouter API client
 */
export class OpenRouterClient {
  private apiKey: string;
  private baseURL: string;
  private headers: Record<string, string>;

  constructor(config: OpenRouterConfig) {
    // Support both direct apiKey and config object
    this.apiKey = typeof config === 'string' ? config : config.apiKey;
    this.baseURL = (typeof config === 'object' ? config.baseURL : undefined) || 'https://openrouter.ai/api/v1';
    this.headers = {
      'HTTP-Referer': 'https://github.com/yourusername/instructionsCreator',
      'X-Title': 'Instructions Creator',
      ...(typeof config === 'object' ? config.headers : undefined),
    };
  }

  /**
   * Make a chat completion request
   */
  async chatCompletion(options: ChatCompletionOptions): Promise<ChatCompletionResult> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 minute timeout

    try {
      console.log(`[OpenRouter] Making request to: ${this.baseURL}/chat/completions`);
      console.log(`[OpenRouter] Model: ${options.model}`);
      console.log(`[OpenRouter] Messages: ${options.messages.length}`);
      console.log(`[OpenRouter] Tools: ${options.tools?.length || 0}`);

      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
          ...this.headers,
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          tools: options.tools,
          tool_choice: options.tool_choice,
          response_format: options.response_format,
          temperature: options.temperature,
          max_tokens: options.max_tokens,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[OpenRouter] API error response: ${errorData}`);
        throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
      }

      const data = await response.json() as ChatCompletionResponse;
      const choice = data.choices[0];
      const assistantMessage = choice.message;

      console.log(`[OpenRouter] Response received`);
      console.log(`[OpenRouter] Finish reason: ${choice.finish_reason}`);
      if (data.usage) {
        console.log(`[OpenRouter] Token usage: ${data.usage.total_tokens} total`);
      }

      return {
        content: assistantMessage.content,
        toolCalls: assistantMessage.tool_calls,
        finishReason: choice.finish_reason,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens,
        } : undefined,
        model: data.model,
      };
    } catch (error) {
      clearTimeout(timeoutId);

      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error('OpenRouter request timeout (>120s)');
      }
      throw error;
    }
  }

  /**
   * Make a simple chat request without tools
   */
  async chat(options: Omit<ChatCompletionOptions, 'tools' | 'tool_choice'>): Promise<string> {
    const result = await this.chatCompletion(options);

    if (!result.content) {
      throw new Error('No content in response');
    }

    return result.content;
  }

  /**
   * Make a JSON-mode request for structured output
   */
  async chatJSON<T>(options: Omit<ChatCompletionOptions, 'tools' | 'tool_choice'>): Promise<T> {
    const result = await this.chatCompletion({
      ...options,
      response_format: { type: 'json_object' },
    });

    if (!result.content) {
      throw new Error('No content in response');
    }

    // Extract JSON from response
    let jsonContent = result.content.trim();

    // Extract JSON from markdown code blocks if present
    const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/) || jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1] || jsonMatch[0];
    }

    return JSON.parse(jsonContent) as T;
  }
}

/**
 * Recommended models
 */
export const RECOMMENDED_MODELS = {
  default: 'anthropic/claude-sonnet-4.5',
  cheap: 'anthropic/claude-3-haiku',
  balanced: 'anthropic/claude-3.5-sonnet',
  geminiFlash: 'google/gemini-2.0-flash-exp:free',
  gemini: 'google/gemini-2.5-flash',
} as const;

/**
 * Create an OpenRouter client with environment variable or provided key
 *
 * Note: For use with SDK config (env vars + onboard config), use getAIConfig()
 * from './config.ts' and pass the apiKey to this function.
 */
export function createOpenRouterClient(config?: OpenRouterConfig): OpenRouterClient {
  // If no config provided, check env var
  if (!config) {
    const key = process.env.OPENROUTER_API_KEY || '';
    if (!key) {
      throw new Error(
        'OpenRouter API key not found. Please set OPENROUTER_API_KEY environment variable ' +
        'or use getAIConfig() from ./config.ts to load from onboard config.'
      );
    }
    return new OpenRouterClient({ apiKey: key });
  }

  return new OpenRouterClient(config);
}

/**
 * Get the model to use from parameter, environment, or default
 */
export function getModel(model?: string): string {
  return model || process.env.OPENROUTER_MODEL || RECOMMENDED_MODELS.default;
}
