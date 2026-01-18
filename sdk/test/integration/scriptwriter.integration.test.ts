/**
 * Integration Tests for Scriptwriter Agent
 *
 * These tests make REAL API calls to OpenRouter.
 * Requires OPENROUTER_API_KEY to be set.
 *
 * Run with: bun test test/integration/scriptwriter.integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { generateScript } from '../../src/ai/agents/scriptwriter.js';
import type { ActionStep } from '../../src/ai/agents/planner.js';

// Skip all tests if no API key
const hasApiKey = process.env.OPENROUTER_API_KEY?.trim().length > 0;

describe('Scriptwriter Integration Tests', { skip: !hasApiKey }, () => {
  beforeAll(() => {
    console.log('[Integration] Using OpenRouter API key for script generation');
  });

  it('should generate script with timestamped actions', { timeout: 60000 }, async () => {
    const recordingSteps: ActionStep[] = [
      { type: 'tap', description: 'Tap the Settings icon in the top right corner' },
      { type: 'tap', description: 'Tap on Notifications' },
      { type: 'swipe', description: 'Scroll down to see more options', direction: 'down' },
      { type: 'tap', description: 'Toggle Enable Notifications' },
      { type: 'type', description: 'Type in notification sound preference', input: 'Chime' },
    ];

    const result = await generateScript({
      recordingSteps,
      videoTitle: 'Configuring Notifications',
      videoDescription: 'Learn how to enable and customize app notifications',
      prompt: 'Teach users how to customize their notification settings',
    });

    // Verify script was generated
    expect(result.script).toBeDefined();
    expect(result.script.length).toBeGreaterThan(50);

    // Verify timing info
    expect(result.totalDuration).toBeGreaterThan(0);
    expect(result.timestampedActions).toBeDefined();
    expect(result.timestampedActions).toHaveLength(5);

    // Verify each action has timing
    result.timestampedActions.forEach((action, index) => {
      expect(action.action).toBe(recordingSteps[index]);
      expect(action.startTime).toBeGreaterThanOrEqual(0);
      expect(action.endTime).toBeGreaterThan(action.startTime);
    });

    console.log(`[Integration] Generated script: ${result.script.substring(0, 100)}...`);
    console.log(`[Integration] Duration: ${result.totalDuration}ms`);
  });

  it('should include ElevenLabs break tags for app loading actions', { timeout: 60000 }, async () => {
    const recordingSteps: ActionStep[] = [
      { type: 'tap', description: 'Tap the Messages app icon on home screen' },
      { type: 'tap', description: 'Tap the compose button to start new message' },
      { type: 'type', description: 'Type recipient name', input: 'John' },
    ];

    const result = await generateScript({
      recordingSteps,
      videoTitle: 'Sending a Message',
    });

    // Should include break tags for app loading
    expect(result.script).toContain('<break time="');
    console.log(`[Integration] Script with breaks: ${result.script}`);
  });

  it('should sync action timing with narration', { timeout: 60000 }, async () => {
    const recordingSteps: ActionStep[] = [
      { type: 'tap', description: 'Tap Settings button' },
      { type: 'tap', description: 'Tap General' },
    ];

    const result = await generateScript({
      recordingSteps,
      videoTitle: 'Testing Timing',
    });

    // First action should happen around when it's mentioned
    const firstAction = result.timestampedActions[0];
    const script = result.script.toLowerCase();

    // Extract when "Settings" is mentioned
    const settingsIndex = script.indexOf('settings');
    const settingsTime = settingsIndex * 430; // Rough estimate

    // Action should be triggered around when mentioned (within 2 seconds)
    expect(Math.abs(firstAction.startTime - settingsTime)).toBeLessThan(2000);

    console.log(`[Integration] "Settings" mentioned at ~${settingsTime}ms, action at ${firstAction.startTime}ms`);
  });

  it('should handle empty recording steps gracefully', { timeout: 60000 }, async () => {
    const result = await generateScript({
      recordingSteps: [],
      videoTitle: 'Empty Test',
    });

    expect(result.script).toBeDefined();
    expect(result.timestampedActions).toHaveLength(0);
  });
});

// Add a simple test that always runs
describe('Scriptwriter Integration Setup', () => {
  it('should indicate when integration tests are skipped', () => {
    if (!hasApiKey) {
      console.log('⚠️  Integration tests skipped - OPENROUTER_API_KEY not set');
      console.log('   Create a .env file with OPENROUTER_API_KEY to run integration tests');
    }
    expect(hasApiKey).toBeDefined();
  });
});
