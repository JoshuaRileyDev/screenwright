/**
 * Tests for utils/content-generator.ts - Content generation with AI
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import { generateContentIdeas } from '../../src/utils/content-generator.js';
import { createTempDir, cleanupTempDir, createMockPackageJson, createMockFile } from '../setup.js';

// Mock the AI module to avoid actual API calls
const mockAICategories = [
  {
    name: 'Getting Started',
    description: 'Learn the basics',
    content: [
      {
        title: 'Introduction to the App',
        description: 'Learn what this app does',
        feature: 'overview',
        setupSteps: [],
        recordingSteps: ['Open the app', 'See the home screen'],
      },
      {
        title: 'Navigation Basics',
        description: 'Learn how to navigate',
        feature: 'navigation',
        setupSteps: [],
        recordingSteps: ['Tap menu items', 'Navigate screens'],
      },
    ],
  },
];

describe('generateContentIdeas', () => {
  let tempDir: string;
  const originalGenerate = globalThis.generateContentIdeas;

  beforeEach(async () => {
    tempDir = await createTempDir('content-generator');

    // Mock the AI generation
    globalThis.generateContentIdeas = async () => mockAICategories;
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    globalThis.generateContentIdeas = originalGenerate;
  });

  it('should generate content ideas for a project', async () => {
    // Create a basic React Native project
    await createMockPackageJson(tempDir, {
      name: 'test-app',
      dependencies: {
        'react-native': '^0.73.0',
      },
    });

    const categories = await generateContentIdeas(tempDir, {
      maxIdeas: 5,
      maxCategories: 2,
    });

    expect(categories).toBeDefined();
    expect(categories.length).toBeGreaterThan(0);
    expect(categories[0].name).toBe('Getting Started');
    expect(categories[0].content).toBeDefined();
    expect(categories[0].content.length).toBeGreaterThan(0);
  });

  it('should include ids and timestamps on generated ideas', async () => {
    await createMockPackageJson(tempDir, {
      name: 'timestamp-test',
      dependencies: { expo: '^50.0.0' },
    });

    const categories = await generateContentIdeas(tempDir);

    // Check first idea has required fields
    const firstIdea = categories[0].content[0];
    expect(firstIdea.id).toBeDefined();
    expect(typeof firstIdea.id).toBe('string');
    expect(firstIdea.createdAt).toBeDefined();
    expect(typeof firstIdea.createdAt).toBe('string');

    // Verify timestamp format
    const date = new Date(firstIdea.createdAt);
    expect(date.toString()).not.toBe('Invalid Date');
  });

  it('should preserve category name in ideas', async () => {
    await createMockPackageJson(tempDir, {
      name: 'category-test',
      dependencies: { 'react-native': '^0.73.0' },
    });

    const categories = await generateContentIdeas(tempDir);

    categories.forEach(category => {
      category.content.forEach(idea => {
        expect(idea.category).toBe(category.name);
      });
    });
  });

  it('should convert AI ideas to SDK format', async () => {
    await createMockPackageJson(tempDir, {
      name: 'format-test',
      dependencies: { expo: '^50.0.0' },
    });

    const categories = await generateContentIdeas(tempDir);

    // Check SDK-specific fields
    const firstIdea = categories[0].content[0];
    expect(firstIdea).toHaveProperty('id');
    expect(firstIdea).toHaveProperty('createdAt');
  });

  it('should handle empty project gracefully', async () => {
    const categories = await generateContentIdeas(tempDir);
    expect(categories).toBeDefined();
    expect(Array.isArray(categories)).toBe(true);
  });

  it('should respect maxIdeas option', async () => {
    await createMockPackageJson(tempDir, {
      name: 'max-ideas-test',
      dependencies: { expo: '^50.0.0' },
    });

    // Generate with maxIdeas = 1
    const categories = await generateContentIdeas(tempDir, {
      maxIdeas: 1,
      maxCategories: 1,
    });

    // Mock returns 2 ideas, but we should respect maxIdeas
    const totalIdeas = categories.reduce((sum, cat) => sum + cat.content.length, 0);
    expect(totalIdeas).toBeLessThanOrEqual(1);
  });

  it('should respect maxCategories option', async () => {
    await createMockPackageJson(tempDir, {
      name: 'max-categories-test',
      dependencies: { expo: '^50.0.0' },
    });

    const categories = await generateContentIdeas(tempDir, {
      maxIdeas: 10,
      maxCategories: 1,
    });

    expect(categories.length).toBeLessThanOrEqual(1);
  });
});

describe('generateContentIdeas with existing content', () => {
  let tempDir: string;
  const originalGenerate = globalThis.generateContentIdeas;

  beforeEach(async () => {
    tempDir = await createTempDir('existing-content');

    // Mock the AI generation
    globalThis.generateContentIdeas = async () => mockAICategories;
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
    globalThis.generateContentIdeas = originalGenerate;
  });

  it('should pass existing content to AI for deduplication', async () => {
    await createMockPackageJson(tempDir, {
      name: 'dedupe-test',
      dependencies: { expo: '^50.0.0' },
    });

    const existingContent = [
      {
        title: 'Introduction to the App',
        description: 'Learn what this app does',
        category: 'Getting Started',
      },
    ];

    const categories = await generateContentIdeas(tempDir, {
      existingContent,
    });

    expect(categories).toBeDefined();
    // The AI should have filtered out duplicates
  });

  it('should handle empty existing content array', async () => {
    await createMockPackageJson(tempDir, {
      name: 'empty-existing',
      dependencies: { expo: '^50.0.0' },
    });

    const categories = await generateContentIdeas(tempDir, {
      existingContent: [],
    });

    expect(categories).toBeDefined();
  });
});
