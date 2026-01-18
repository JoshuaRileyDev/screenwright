/**
 * Integration Tests for Content Creator Agent
 *
 * These tests make REAL API calls to OpenRouter and analyze REAL codebases.
 * Requires OPENROUTER_API_KEY to be set in environment or .env file.
 *
 * Run with: bun test test/integration/content-creator.integration.test.ts
 */

import { describe, it, expect, beforeAll } from 'bun:test';
import { dirname, join } from 'node:path';
import { generateContentIdeas as aiGenerateContentIdeas } from '../../src/ai/agents/content-creator.js';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(__dirname, '../fixtures');

// Skip all tests if no API key
const hasApiKey = process.env.OPENROUTER_API_KEY?.trim().length > 0;

describe('Content Creator Integration Tests', { skip: !hasApiKey }, () => {
  let apiKey: string;

  beforeAll(() => {
    apiKey = process.env.OPENROUTER_API_KEY!.trim();
    console.log('[Integration] Using OpenRouter API key');
  });

  it('should generate content ideas for SwiftUI login app', { timeout: 120000 }, async () => {
    const projectPath = join(fixturesDir, 'loginExample');
    console.log(`[Integration] Analyzing: ${projectPath}`);

    const categories = await aiGenerateContentIdeas({
      projectPath,
      maxIdeas: 5,
      maxCategories: 2,
    });

    // Verify we got categories
    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
    expect(categories.length).toBeGreaterThan(0);

    // Verify category structure
    const firstCategory = categories[0];
    expect(firstCategory.name).toBeDefined();
    expect(firstCategory.description).toBeDefined();
    expect(firstCategory.content).toBeDefined();
    expect(firstCategory.content.length).toBeGreaterThan(0);

    // Verify idea structure
    const firstIdea = firstCategory.content[0];
    expect(firstIdea.title).toBeDefined();
    expect(firstIdea.title.length).toBeGreaterThan(0);
    expect(firstIdea.description).toBeDefined();
    expect(firstIdea.feature).toBeDefined();
    expect(Array.isArray(firstIdea.setupSteps)).toBe(true);
    expect(Array.isArray(firstIdea.recordingSteps)).toBe(true);

    // Log results for inspection
    console.log(`[Integration] Generated ${categories.length} categories`);
    categories.forEach((cat, i) => {
      console.log(`[Integration] Category ${i + 1}: "${cat.name}" (${cat.content.length} ideas)`);
      cat.content.forEach((idea) => {
        console.log(`[Integration]   - "${idea.title}"`);
      });
    });
  });

  it('should generate user-focused (not developer-focused) content', { timeout: 120000 }, async () => {
    const projectPath = join(fixturesDir, 'loginExample');

    const categories = await aiGenerateContentIdeas({
      projectPath,
      maxIdeas: 3,
      maxCategories: 1,
    });

    // Get all idea titles
    const allTitles = categories.flatMap(cat => cat.content.map(idea => idea.title.toLowerCase()));

    // Should NOT contain developer/technical terms
    const technicalTerms = ['component', 'api', 'code', 'architecture', 'implementation', 'debug'];
    const hasTechnicalTerms = technicalTerms.some(term =>
      allTitles.some(title => title.includes(term))
    );

    expect(hasTechnicalTerms).toBe(false);

    // Should contain user-focused terms
    const userTerms = ['how to', 'using', 'create', 'login', 'dashboard'];
    const hasUserTerms = userTerms.some(term =>
      allTitles.some(title => title.includes(term))
    );

    // This is a login app, so should mention login-related terms
    expect(hasUserTerms).toBe(true);
  });

  it('should include setupSteps and recordingSteps with specific instructions', { timeout: 120000 }, async () => {
    const projectPath = join(fixturesDir, 'loginExample');

    const categories = await aiGenerateContentIdeas({
      projectPath,
      maxIdeas: 3,
      maxCategories: 1,
    });

    // Check first idea
    const firstIdea = categories[0].content[0];

    // Should have setup steps
    expect(Array.isArray(firstIdea.setupSteps)).toBe(true);

    // Should have recording steps
    expect(Array.isArray(firstIdea.recordingSteps)).toBe(true);
    expect(firstIdea.recordingSteps.length).toBeGreaterThan(0);

    // Recording steps should be specific (not vague)
    const firstStep = firstIdea.recordingSteps[0].toLowerCase();
    expect(firstStep.length).toBeGreaterThan(10); // Should be descriptive

    console.log(`[Integration] Sample recording steps: ${firstIdea.recordingSteps.join(' | ')}`);
  });

  it('should handle existing content deduplication', { timeout: 120000 }, async () => {
    const projectPath = join(fixturesDir, 'loginExample');

    const existingContent = [
      {
        title: 'Logging In to the App',
        description: 'How to log in',
        category: 'Getting Started',
      },
    ];

    const categories = await aiGenerateContentIdeas({
      projectPath,
      existingContent,
      maxIdeas: 3,
      maxCategories: 1,
    });

    // Should not duplicate existing content
    const allTitles = categories.flatMap(cat => cat.content.map(idea => idea.title));
    const hasDuplicate = allTitles.some(title => title === 'Logging In to the App');

    expect(hasDuplicate).toBe(false);
  });

  it('should include Getting Started category', { timeout: 120000 }, async () => {
    const projectPath = join(fixturesDir, 'loginExample');

    const categories = await aiGenerateContentIdeas({
      projectPath,
      maxIdeas: 3,
      maxCategories: 2,
    });

    // Should have Getting Started category
    const hasGettingStarted = categories.some(cat =>
      cat.name === 'Getting Started'
    );

    expect(hasGettingStarted).toBe(true);
  });

  it('should respect maxIdeas limit', { timeout: 120000 }, async () => {
    const projectPath = join(fixturesDir, 'loginExample');

    const categories = await aiGenerateContentIdeas({
      projectPath,
      maxIdeas: 2,
      maxCategories: 1,
    });

    const totalIdeas = categories.reduce((sum, cat) => sum + cat.content.length, 0);
    expect(totalIdeas).toBeLessThanOrEqual(2);
  });
});

// Add a simple test that always runs to indicate if tests are being skipped
describe('Content Creator Integration Setup', () => {
  it('should indicate when integration tests are skipped', () => {
    if (!hasApiKey) {
      console.log('⚠️  Integration tests skipped - OPENROUTER_API_KEY not set');
      console.log('   Create a .env file with OPENROUTER_API_KEY to run integration tests');
      console.log('   Copy .env.example to .env and add your key');
    }
    expect(hasApiKey).toBeDefined();
  });
});
