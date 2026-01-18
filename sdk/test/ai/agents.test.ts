/**
 * Tests for AI agents (content-creator, scriptwriter, planner)
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { createTempDir, cleanupTempDir, createMockPackageJson, createMockFile, mockSpawn } from '../setup.js';

describe('Content Creator Agent', () => {
  let tempDir: string;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    tempDir = await createTempDir('content-creator-agent');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    globalThis.fetch = originalFetch;
  });

  it('should explore codebase and generate content ideas', async () => {
    // Create a mock project structure
    await createMockPackageJson(tempDir, {
      name: 'test-app',
      description: 'A test application',
      dependencies: {
        expo: '^50.0.0',
        'react-navigation': '^6.0.0',
      },
    });

    await createMockFile(tempDir, 'README.md', '# Test App\n\nA sample Expo app for testing.');

    await createMockFile(tempDir, 'app.json', JSON.stringify({
      expo: {
        name: 'test-app',
        slug: 'test-app',
        version: '1.0.0',
      },
    }));

    // Mock OpenRouter API response
    const mockAIResponse = {
      categories: [
        {
          name: 'Getting Started',
          description: 'Learn the basics',
          content: [
            {
              title: 'Introduction to Test App',
              description: 'Learn what this app does',
              feature: 'overview',
              setupSteps: [],
              recordingSteps: ['Open the app', 'See the home screen'],
            },
          ],
        },
      ],
    };

    globalThis.fetch = async () => new Response(JSON.stringify(mockAIResponse));

    // Import and test the agent
    const { generateContentIdeas } = await import('../../src/ai/agents/content-creator.js');

    const result = await generateContentIdeas({
      projectPath: tempDir,
      maxIdeas: 5,
      maxCategories: 2,
    });

    expect(result).toBeDefined();
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Getting Started');
    expect(result[0].content).toHaveLength(1);
  });

  it('should handle API errors gracefully', async () => {
    await createMockPackageJson(tempDir, {
      name: 'error-test',
      dependencies: { expo: '^50.0.0' },
    });

    globalThis.fetch = async () => new Response('API Error', { status: 500 });

    const { generateContentIdeas } = await import('../../src/ai/agents/content-creator.js');

    await expect(generateContentIdeas({
      projectPath: tempDir,
    })).rejects.toThrow();
  });
});

describe('Scriptwriter Agent', () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('should generate script with timestamped actions', async () => {
    const recordingSteps = [
      { type: 'tap' as const, description: 'Tap the Settings button' },
      { type: 'tap' as const, description: 'Toggle notifications' },
      { type: 'swipe' as const, description: 'Scroll down', direction: 'down' as const },
    ];

    const mockScriptResponse = {
      script: 'Let\'s open Settings. <break time="2.0s" /> Now tap on General.',
      totalDuration: 5000,
      timestampedActions: [
        { actionIndex: 0, startTime: 500, endTime: 1000 },
        { actionIndex: 1, startTime: 2500, endTime: 3000 },
        { actionIndex: 2, startTime: 4000, endTime: 5000 },
      ],
    };

    globalThis.fetch = async () => new Response(JSON.stringify(mockScriptResponse));

    const { generateScript } = await import('../../src/ai/agents/scriptwriter.js');

    const result = await generateScript({
      recordingSteps,
      videoTitle: 'Test Video',
      videoDescription: 'A test video',
      prompt: 'Teach users about settings',
    });

    expect(result.script).toContain('Let\'s open Settings');
    expect(result.script).toContain('<break time="2.0s" />');
    expect(result.totalDuration).toBe(5000);
    expect(result.timestampedActions).toHaveLength(3);
  });

  it('should include ElevenLabs break syntax for app loading', async () => {
    const recordingSteps = [
      { type: 'tap' as const, description: 'Tap Messages app icon' },
      { type: 'type' as const, description: 'Type phone number', input: '12345' },
    ];

    const mockScriptResponse = {
      script: 'Open Messages. <break time="2.0s" /> Type 12345. <break time="1.0s" /> Done.',
      totalDuration: 6000,
      timestampedActions: [
        { actionIndex: 0, startTime: 500, endTime: 1000 },
        { actionIndex: 1, startTime: 3500, endTime: 5500 },
      ],
    };

    globalThis.fetch = async () => new Response(JSON.stringify(mockScriptResponse));

    const { generateScript } = await import('../../src/ai/agents/scriptwriter.js');

    const result = await generateScript({
      recordingSteps,
      videoTitle: 'Sending Messages',
    });

    expect(result.script).toContain('<break time="2.0s" />');
    expect(result.script).toContain('<break time="1.0s" />');
  });

  it('should handle timeout errors', async () => {
    const recordingSteps = [{ type: 'tap' as const, description: 'Tap' }];

    // Create a fetch that times out
    const timeoutPromise = new Promise(() => {});
    globalThis.fetch = async () => timeoutPromise;

    // Abort the request after a short time
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 100);

    const { generateScript } = await import('../../src/ai/agents/scriptwriter.js');

    // This should handle the timeout
    const resultPromise = generateScript({ recordingSteps });
    await expect(resultPromise).rejects.toThrow();
  });
});

describe('Planner Agent', () => {
  let tempDir: string;
  const originalFetch = globalThis.fetch;

  beforeEach(async () => {
    tempDir = await createTempDir('planner-agent');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    globalThis.fetch = originalFetch;
  });

  it('should generate recording plan with tool calling', async () => {
    const videoIdea = {
      title: 'Test Video',
      description: 'A test video',
      feature: 'settings',
      setupSteps: ['Open Settings'],
      recordingSteps: ['Toggle a switch'],
    };

    const mockAutomation = {
      takeScreenshot: async () => ({
        screenshot: 'base64screenshotdata',
        format: 'png',
        width: 393,
        height: 852,
      }),
      listElements: async () => ({
        elements: [
          {
            type: 'Button',
            label: 'Settings',
            x: 100,
            y: 200,
            width: 50,
            height: 44,
            enabled: true,
            visible: true,
          },
        ],
      }),
      tapAt: async () => ({ success: true }),
      swipe: async () => ({ success: true }),
      typeText: async () => ({ success: true }),
      terminateAllApps: async () => {},
      pressButton: async () => {},
    };

    // Mock the planner API response with final plan
    let callCount = 0;
    globalThis.fetch = async () => {
      callCount++;
      if (callCount === 1) {
        // First call - return tool calls
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: null,
              tool_calls: [{
                id: 'call-1',
                type: 'function',
                function: {
                  name: 'mobile_take_screenshot',
                  arguments: '{}',
                },
              }],
            },
            finish_reason: 'tool_calls',
          }],
        }));
      } else {
        // Second call - return the final plan
        return new Response(JSON.stringify({
          choices: [{
            message: {
              content: JSON.stringify({
                title: 'Test Video Plan',
                description: 'A test plan',
                setupSteps: [],
                recordingSteps: [
                  {
                    type: 'tap',
                    description: 'Toggle a switch',
                    target: { x: 125, y: 222 },
                  },
                ],
                estimatedDurationSeconds: 30,
                screenshots: [],
              }),
            },
            finish_reason: 'stop',
          }],
        }));
      }
    };

    const { generateRecordingPlan } = await import('../../src/ai/agents/planner-impl.js');

    const result = await generateRecordingPlan(
      {
        simulatorUdid: 'test-simulator-udid',
        videoIdea,
      },
      mockAutomation
    );

    expect(result).toBeDefined();
    expect(result.title).toBeDefined();
    expect(result.recordingSteps).toHaveLength(1);
  });

  it('should validate plan has recording steps', async () => {
    const videoIdea = {
      title: 'Empty Plan Test',
      description: 'Test',
      feature: 'test',
      setupSteps: [],
      recordingSteps: [],
    };

    const mockAutomation = {
      takeScreenshot: async () => ({
        screenshot: 'data',
        format: 'png',
        width: 393,
        height: 852,
      }),
      listElements: async () => ({ elements: [] }),
      tapAt: async () => ({ success: true }),
      swipe: async () => ({ success: true }),
      typeText: async () => ({ success: true }),
      terminateAllApps: async () => {},
      pressButton: async () => {},
    };

    // Mock response with empty recording steps (should fail validation)
    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Invalid Plan',
            description: 'No steps',
            setupSteps: [],
            recordingSteps: [], // Empty - should fail validation
            estimatedDurationSeconds: 0,
            screenshots: [],
          }),
        },
        finish_reason: 'stop',
      }],
    }));

    const { generateRecordingPlan } = await import('../../src/ai/agents/planner-impl.js');

    await expect(generateRecordingPlan(
      {
        simulatorUdid: 'test-udid',
        videoIdea,
      },
      mockAutomation
    )).rejects.toThrow('recordingSteps is empty');
  });

  it('should reset simulator after planning', async () => {
    const videoIdea = {
      title: 'Reset Test',
      description: 'Test',
      feature: 'test',
      setupSteps: [],
      recordingSteps: [{ type: 'tap' as const, description: 'Tap' }],
    };

    let terminateCalled = false;
    let homePressed = false;

    const mockAutomation = {
      takeScreenshot: async () => ({
        screenshot: 'data',
        format: 'png',
        width: 393,
        height: 852,
      }),
      listElements: async () => ({ elements: [] }),
      tapAt: async () => ({ success: true }),
      swipe: async () => ({ success: true }),
      typeText: async () => ({ success: true }),
      terminateAllApps: async () => {
        terminateCalled = true;
      },
      pressButton: async (udid: string, button: string) => {
        if (button === 'home') homePressed = true;
      },
    };

    globalThis.fetch = async () => new Response(JSON.stringify({
      choices: [{
        message: {
          content: JSON.stringify({
            title: 'Reset Test Plan',
            description: 'Test',
            setupSteps: [],
            recordingSteps: [{ type: 'tap', description: 'Tap', target: { x: 100, y: 100 } }],
            estimatedDurationSeconds: 30,
            screenshots: [],
          }),
        },
        finish_reason: 'stop',
      }],
    }));

    const { generateRecordingPlan } = await import('../../src/ai/agents/planner-impl.js');

    await generateRecordingPlan(
      { simulatorUdid: 'test-udid', videoIdea },
      mockAutomation
    );

    // Verify simulator was reset
    expect(terminateCalled).toBe(true);
    expect(homePressed).toBe(true);
  });
});
