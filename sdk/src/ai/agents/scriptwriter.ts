/**
 * Scriptwriter Agent
 * Creates voiceover scripts with precise timing for tutorial videos
 */

import { createOpenRouterClient } from '../openrouter.js';
import { getOpenRouterApiKey, getModel } from '../config.js';
import { SCRIPTWRITER_SYSTEM_PROMPT, SCRIPTWRITER_USER_TEMPLATE } from '../prompts/scriptwriter.js';
import type { ActionStep } from './planner.js';

export interface TimestampedActionSimple {
  actionIndex: number; // Index into the recordingSteps array
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
}

export interface TimestampedAction {
  action: ActionStep;
  startTime: number; // in milliseconds
  endTime: number; // in milliseconds
}

export interface ScriptOutput {
  script: string; // Full conversational voiceover script
  totalDuration: number; // Total duration in milliseconds
  timestampedActions: TimestampedAction[];
}

export interface ScriptWriterInput {
  prompt: string;
  recordingSteps: ActionStep[];
  videoTitle?: string;
  videoDescription?: string;
}

/**
 * Populate a template with dynamic data
 */
function populateTemplate(template: string, data: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(data)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, 'g'), value);
  }
  return result;
}

/**
 * Generate a voiceover script with timestamped actions
 */
export async function generateScript(input: ScriptWriterInput): Promise<ScriptOutput> {
  console.log('[Scriptwriter] Starting script generation...');
  console.log(`[Scriptwriter] Video: ${input.videoTitle || 'Untitled'}`);
  console.log(`[Scriptwriter] Recording steps: ${input.recordingSteps.length}`);

  // Build the user prompt with context
  const recordingStepsList = input.recordingSteps
    .map((step, i) => `${i + 1}. ${step.description}`)
    .join('\n');

  const userPrompt = populateTemplate(SCRIPTWRITER_USER_TEMPLATE, {
    videoTitle: input.videoTitle ? `**Video Title:** ${input.videoTitle}\n` : '',
    videoDescription: input.videoDescription ? `**Description:** ${input.videoDescription}\n` : '',
    tutorialGoal: input.prompt ? `**Tutorial Goal:** ${input.prompt}\n` : '',
    recordingSteps: recordingStepsList,
    actionCount: input.recordingSteps.length.toString(),
  });

  console.log('[Scriptwriter] Calling OpenRouter API...');

  try {
    const [apiKey, model] = await Promise.all([
      getOpenRouterApiKey(),
      getModel('scriptwriter'),
    ]);
    const client = createOpenRouterClient(apiKey);

    const result = await client.chatJSON<{
      script: string;
      totalDuration: number;
      timestampedActions: TimestampedActionSimple[];
    }>({
      model,
      messages: [
        { role: 'system', content: SCRIPTWRITER_SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      response_format: { type: 'json_object' },
    });

    console.log('[Scriptwriter] Generation complete!');
    console.log(`[Scriptwriter] Script length: ${result.script.length} chars`);
    console.log(`[Scriptwriter] Total duration: ${result.totalDuration}ms (${(result.totalDuration / 1000).toFixed(1)}s)`);
    console.log(`[Scriptwriter] Timestamped actions: ${result.timestampedActions.length}`);

    // Validate that we have the same number of actions
    if (result.timestampedActions.length !== input.recordingSteps.length) {
      console.warn(`[Scriptwriter] ⚠️  Warning: Expected ${input.recordingSteps.length} actions but got ${result.timestampedActions.length}`);
    }

    // Reconstruct full TimestampedAction objects by looking up actions by index
    const timestampedActions: TimestampedAction[] = result.timestampedActions.map(ta => {
      const action = input.recordingSteps[ta.actionIndex];
      if (!action) {
        throw new Error(`Invalid actionIndex ${ta.actionIndex} - recording has only ${input.recordingSteps.length} steps`);
      }
      return {
        action,
        startTime: ta.startTime,
        endTime: ta.endTime,
      };
    });

    // Log timing breakdown
    console.log('[Scriptwriter] Timing breakdown:');
    timestampedActions.forEach((ta, i) => {
      const duration = ta.endTime - ta.startTime;
      console.log(`[Scriptwriter]   ${i + 1}. ${ta.action.description}`);
      console.log(`[Scriptwriter]      ${ta.startTime}ms - ${ta.endTime}ms (${duration}ms duration)`);
    });

    return {
      script: result.script,
      totalDuration: result.totalDuration,
      timestampedActions,
    };
  } catch (error) {
    console.error('[Scriptwriter] ❌ Error during generation:', error);

    // Provide more helpful error messages
    if (error instanceof Error) {
      if (error.name === 'AbortError') {
        const enhancedError = new Error(
          'Script generation was aborted. This could be due to:\n' +
          '1. Request timeout (>120s) - try again\n' +
          '2. Network issues - check your internet connection\n' +
          '3. OpenRouter API issues - check https://status.openrouter.ai/\n' +
          `Original error: ${error.message}`
        );
        enhancedError.name = 'ScriptGenerationAbortError';
        throw enhancedError;
      }
    }

    throw error;
  }
}
