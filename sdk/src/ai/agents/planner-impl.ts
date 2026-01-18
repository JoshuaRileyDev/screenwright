/**
 * Planner Agent Implementation
 * Creates detailed recording plans by physically testing workflows on simulator using tool calling
 */

import { createOpenRouterClient, type Tool, type ChatMessage, type ToolCall } from '../openrouter.js';
import { getOpenRouterApiKey, getModel } from '../config.js';
import { PLANNER_SYSTEM_PROMPT, PLANNER_USER_TEMPLATE } from '../prompts/planner.js';
import type { PlannerInput, RecordingPlan, MobileAutomation, ActionStep } from './planner.js';

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
 * Generate a detailed recording plan using Mobile Automation with tool calling
 */
export async function generateRecordingPlan(
  input: PlannerInput,
  automation: MobileAutomation
): Promise<RecordingPlan> {
  console.log('[Planner] Starting plan generation...');
  console.log(`[Planner] Video: ${input.videoIdea.title}`);
  console.log(`[Planner] Simulator: ${input.simulatorUdid}`);

  // System prompt is static
  const systemPrompt = PLANNER_SYSTEM_PROMPT;

  // Populate user prompt with dynamic data
  const userPrompt = populateTemplate(PLANNER_USER_TEMPLATE, {
    title: input.videoIdea.title,
    description: input.videoIdea.description,
    feature: input.videoIdea.feature,
    setupSteps: input.videoIdea.setupSteps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
    recordingSteps: input.videoIdea.recordingSteps.map((step, i) => `${i + 1}. ${step}`).join('\n'),
  });

  const messages: ChatMessage[] = [
    { role: 'user', content: userPrompt },
  ];

  // Define tools for the AI to interact with the simulator
  const tools: Tool[] = [
    {
      type: 'function',
      function: {
        name: 'mobile_take_screenshot',
        description: 'Capture current device display as a base64 image',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mobile_list_elements_on_screen',
        description: 'Get all UI elements with coordinates and attributes',
        parameters: {
          type: 'object',
          properties: {},
          required: [],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mobile_click_on_screen_at_coordinates',
        description: 'Tap at specified coordinates',
        parameters: {
          type: 'object',
          properties: {
            x: { type: 'number', description: 'X coordinate' },
            y: { type: 'number', description: 'Y coordinate' },
          },
          required: ['x', 'y'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mobile_swipe_on_screen',
        description: 'Swipe in a direction',
        parameters: {
          type: 'object',
          properties: {
            direction: {
              type: 'string',
              enum: ['up', 'down', 'left', 'right'],
              description: 'Swipe direction',
            },
          },
          required: ['direction'],
        },
      },
    },
    {
      type: 'function',
      function: {
        name: 'mobile_type_keys',
        description: 'Type text into focused field',
        parameters: {
          type: 'object',
          properties: {
            text: { type: 'string', description: 'Text to type' },
            submit: { type: 'boolean', description: 'Whether to submit after typing' },
          },
          required: ['text'],
        },
      },
    },
  ];

  let iterationCount = 0;
  const maxIterations = 100;

  try {
    const [apiKey, model] = await Promise.all([
      getOpenRouterApiKey(),
      getModel('planner'),
    ]);
    const client = createOpenRouterClient(apiKey);

    while (iterationCount < maxIterations) {
      iterationCount++;
      console.log('');
      console.log(`[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
      console.log(`[Planner] 🔄 Iteration ${iterationCount}/${maxIterations}`);
      console.log(`[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

      // Call OpenRouter API
      console.log(`[Planner] 📡 Calling OpenRouter API...`);

      const response = await client.chatCompletion({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          ...messages,
        ],
        tools,
        tool_choice: 'auto',
      });

      console.log(`[Planner] ✓ Response received`);
      console.log(`[Planner]   Finish reason: ${response.finishReason}`);
      if (response.model) {
        console.log(`[Planner]   Model: ${response.model}`);
      }

      // Add assistant message to history
      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: response.content || '',
      };

      // Check if we have tool calls
      if (response.toolCalls && response.toolCalls.length > 0) {
        console.log(`[Planner] Processing ${response.toolCalls.length} tool calls`);

        const toolResults: ChatMessage[] = [];

        for (const toolCall of response.toolCalls) {
          const toolName = toolCall.function.name;
          const toolArgsStr = toolCall.function.arguments;

          console.log(`[Planner] Tool call:`, { name: toolName, arguments: toolArgsStr });

          let toolArgs: Record<string, unknown> = {};
          if (toolArgsStr && toolArgsStr.trim()) {
            try {
              toolArgs = JSON.parse(toolArgsStr);
            } catch (parseError) {
              console.error(`[Planner] Failed to parse tool arguments:`, toolArgsStr);
              toolArgs = {};
            }
          }

          console.log(`[Planner] Executing: ${toolName}`, toolArgs);

          try {
            const result = await executeMCPTool(toolName, toolArgs, input.simulatorUdid, automation);

            // Log the result (with truncation for large data like screenshots)
            console.log(`[Planner] ✓ Tool result received`);
            if (result && typeof result === 'object') {
              const resultCopy = { ...result };
              // Truncate screenshot data in logs
              if ('screenshot' in resultCopy && typeof resultCopy.screenshot === 'string') {
                const originalLength = resultCopy.screenshot.length;
                (resultCopy as { screenshot: string }).screenshot = `[${originalLength} chars] ${(resultCopy.screenshot as string).substring(0, 50)}...`;
              }
              console.log(`[Planner]   Result:`, JSON.stringify(resultCopy, null, 2));
            } else {
              console.log(`[Planner]   Result:`, result);
            }

            // Special handling for screenshots - send as vision message
            if (toolName === 'mobile_take_screenshot' && result && typeof result === 'object' && 'screenshot' in result) {
              // Type guard for screenshot result
              const screenshotResult = result as { screenshot: string; format?: string; width?: number; height?: number };

              // Return tool result with success message (no base64)
              toolResults.push({
                role: 'tool',
                content: JSON.stringify({
                  success: true,
                  format: screenshotResult.format || 'png',
                  width: screenshotResult.width,
                  height: screenshotResult.height,
                  message: 'Screenshot captured and attached as image',
                }),
              });

              // Add follow-up user message with actual image for vision
              toolResults.push({
                role: 'user',
                content: JSON.stringify({
                  type: 'image_url',
                  image_url: {
                    url: `data:image/${screenshotResult.format || 'png'};base64,${screenshotResult.screenshot}`,
                  },
                }),
              });
              console.log(`[Planner] 📸 Screenshot formatted as vision message for model`);
            } else {
              // For other tools, return result as normal
              toolResults.push({
                role: 'tool',
                content: JSON.stringify(result),
              });
            }
          } catch (error) {
            console.error(`[Planner] ❌ Tool execution failed:`, error);
            toolResults.push({
              role: 'tool',
              content: JSON.stringify({
                error: error instanceof Error ? error.message : String(error),
              }),
            });
          }
        }

        // Add tool results to messages
        console.log(`[Planner] 💬 Adding ${toolResults.length} tool results to conversation`);
        messages.push(assistantMessage, ...toolResults);
      } else if (response.content) {
        // No more tool calls, extract the plan
        console.log('');
        console.log('[Planner] 📋 No more tool calls, extracting final plan...');
        console.log('[Planner] Content length:', response.content.length, 'chars');

        let content = response.content;

        // Check if content looks like JSON
        const looksLikeJson = content.trim().startsWith('{') && content.includes('"title"');

        if (!looksLikeJson) {
          console.log('[Planner] ⚠️  Response is not JSON, making follow-up call with json_object format...');

          // Add user message requesting JSON output
          messages.push(assistantMessage, {
            role: 'user',
            content: 'Please output the complete JSON plan now. Output ONLY the JSON object, no other text.',
          });

          // Make ONE more API call with response_format to force JSON
          const jsonResponse = await client.chatCompletion({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              ...messages,
            ],
            response_format: { type: 'json_object' },
          });

          content = jsonResponse.content || '';
          console.log('[Planner] ✓ Received JSON response');
          console.log('[Planner] Response length:', content.length, 'chars');
        }

        // Extract JSON from response - try multiple strategies
        let jsonStr: string;

        // Strategy 1: Markdown code blocks
        const markdownMatch = content.match(/```json\n([\s\S]+?)\n```/) || content.match(/```\n([\s\S]+?)\n```/);

        if (markdownMatch) {
          jsonStr = markdownMatch[1];
          console.log('[Planner] 🔍 Extracted JSON from markdown code block');
        }
        // Strategy 2: Find JSON object anywhere in text (look for { ... })
        else {
          const jsonObjectMatch = content.match(/\{[\s\S]*"title"[\s\S]*"recordingSteps"[\s\S]*\}/);

          if (jsonObjectMatch) {
            jsonStr = jsonObjectMatch[0];
            console.log('[Planner] 🔍 Extracted JSON object from text');
          }
          // Strategy 3: Assume entire content is JSON
          else {
            jsonStr = content.trim();
            console.log('[Planner] 🔍 Using entire content as JSON');
          }
        }

        // Log the full JSON output
        console.log('');
        console.log('[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[Planner] 📄 FULL JSON OUTPUT:');
        console.log('[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(jsonStr);
        console.log('[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        console.log('[Planner] 🔍 Parsing JSON...');
        const plan = JSON.parse(jsonStr) as RecordingPlan;

        // Validate the plan has actual steps
        if (plan.recordingSteps.length === 0) {
          console.error('[Planner] ❌ VALIDATION FAILED: Plan has 0 recording steps!');
          console.error('[Planner] The agent did not test the workflow as required.');
          throw new Error(
            'Plan validation failed: recordingSteps is empty. The planner must physically test the workflow and create actionable steps.'
          );
        }

        console.log('');
        console.log('[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[Planner] ✅ Plan generated successfully!');
        console.log('[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log(`[Planner] 📊 Setup steps: ${plan.setupSteps.length}`);
        console.log(`[Planner] 📊 Recording steps: ${plan.recordingSteps.length}`);
        console.log(`[Planner] ⏱️  Estimated duration: ${plan.estimatedDurationSeconds}s`);
        console.log(`[Planner] 📸 Screenshots captured: ${plan.screenshots?.length || 0}`);
        console.log('[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Log detailed setup actions
        if (plan.setupSteps.length > 0) {
          console.log('');
          console.log('[Planner] 🔧 SETUP ACTIONS (will run before recording):');
          plan.setupSteps.forEach((step, i) => {
            const stepType = step.type ? step.type.toUpperCase() : 'UNKNOWN';
            const stepDesc = step.description || 'No description';
            console.log(`[Planner]   ${i + 1}. ${stepType} - ${stepDesc}`);
            if (step.target?.x !== undefined && step.target?.y !== undefined) {
              console.log(`[Planner]      → Coordinates: (${step.target.x}, ${step.target.y})`);
            }
            if (step.input) {
              console.log(`[Planner]      → Input: "${step.input}"`);
            }
            if (step.direction) {
              console.log(`[Planner]      → Direction: ${step.direction}`);
            }
            if (step.waitMs) {
              console.log(`[Planner]      → Wait: ${step.waitMs}ms`);
            }
          });
        }

        // Log detailed recording actions
        console.log('');
        console.log('[Planner] 🎬 RECORDING ACTIONS (will be recorded in video):');
        plan.recordingSteps.forEach((step, i) => {
          const stepType = step.type ? step.type.toUpperCase() : 'UNKNOWN';
          const stepDesc = step.description || 'No description';
          console.log(`[Planner]   ${i + 1}. ${stepType} - ${stepDesc}`);
          if (step.target?.x !== undefined && step.target?.y !== undefined) {
            console.log(`[Planner]      → Coordinates: (${step.target.x}, ${step.target.y})`);
          }
          if (step.input) {
            console.log(`[Planner]      → Input: "${step.input}"`);
          }
          if (step.direction) {
            console.log(`[Planner]      → Direction: ${step.direction}`);
          }
          if (step.button) {
            console.log(`[Planner]      → Button: ${step.button}`);
          }
          if (step.waitMs) {
            console.log(`[Planner]      → Wait: ${step.waitMs}ms`);
          }
        });
        console.log('[Planner] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

        // Reset simulator to home screen for recording
        console.log('');
        console.log('[Planner] 🔄 Resetting simulator to clean state...');
        try {
          // Terminate all apps to ensure clean slate
          await automation.terminateAllApps(input.simulatorUdid);

          // Press home to return to home screen
          await automation.pressButton(input.simulatorUdid, 'home');
          console.log('[Planner] ✓ Returned to home screen');

          // Wait for UI to settle
          await new Promise(resolve => setTimeout(resolve, 1000));
          console.log('[Planner] ✓ Simulator reset complete - ready for recording');
        } catch (resetError) {
          console.warn('[Planner] ⚠️  Warning: Failed to reset simulator:', resetError);
          console.warn('[Planner] ⚠️  Recording may start from incorrect state');
        }

        return plan;
      } else {
        throw new Error('Unexpected response format from OpenRouter');
      }
    }

    throw new Error('Max iterations reached without generating plan');
  } catch (error) {
    console.error('[Planner] ❌ Error during generation:', error);
    throw error;
  }
}

/**
 * Execute Mobile Automation tool
 */
async function executeMCPTool(
  toolName: string,
  args: Record<string, unknown>,
  simulatorUdid: string,
  automation: MobileAutomation
): Promise<unknown> {
  // Log action with clear formatting
  switch (toolName) {
    case 'mobile_take_screenshot':
      console.log(`[Mobile Tool] 📸 Taking screenshot...`);
      return await automation.takeScreenshot(simulatorUdid);

    case 'mobile_list_elements_on_screen':
      console.log(`[Mobile Tool] 🔍 Listing UI elements...`);
      return await automation.listElements(simulatorUdid);

    case 'mobile_click_on_screen_at_coordinates':
      console.log(`[Mobile Tool] 👆 TESTING TAP at coordinates (${args.x}, ${args.y})`);
      return await automation.tapAt(simulatorUdid, args.x as number, args.y as number);

    case 'mobile_swipe_on_screen':
      console.log(`[Mobile Tool] 👉 TESTING SWIPE ${(args.direction as string).toUpperCase()}`);
      return await automation.swipe(simulatorUdid, args.direction as 'up' | 'down' | 'left' | 'right');

    case 'mobile_type_keys':
      console.log(`[Mobile Tool] ⌨️  TESTING TYPE: "${args.text}"${args.submit ? ' + SUBMIT' : ''}`);
      return await automation.typeText(simulatorUdid, args.text as string, args.submit as boolean | undefined);

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
