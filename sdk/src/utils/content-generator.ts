/**
 * Content generation utilities - Generate video ideas from project
 *
 * Uses AI-powered content analysis via OpenRouter to generate
 * user-focused tutorial video ideas from codebases.
 */

import type { ContentCategory, ContentIdea, GenerateContentOptions } from '../types-video.js';
import { generateContentIdeas as aiGenerateContentIdeas, type AIContentCategory } from '../ai/index.js';

/**
 * Generate content ideas based on AI-powered codebase analysis
 *
 * This function uses the Content Creator AI agent to analyze the codebase
 * and generate user-facing tutorial video ideas.
 */
export async function generateContentIdeas(
  projectPath: string,
  options: GenerateContentOptions = {}
): Promise<ContentCategory[]> {
  console.log('[Content] Using AI-powered content generation...');

  // Convert existing content to AI format
  const existingContent = options.existingContent?.map(item => ({
    title: item.title,
    description: item.description || '',
    category: item.category,
  })) || [];

  // Call AI-powered content generation
  const aiCategories = await aiGenerateContentIdeas({
    projectPath,
    existingContent,
    maxIdeas: options.maxIdeas || 10,
    maxCategories: options.maxCategories || 3,
  });

  // Convert AI content categories to SDK format with IDs and timestamps
  const categories: ContentCategory[] = aiCategories.map((cat, catIndex) => ({
    name: cat.name,
    description: cat.description,
    content: cat.content.map((idea, ideaIndex) => ({
      id: `idea_${Date.now()}_${catIndex}_${ideaIndex}`,
      title: idea.title,
      description: idea.description,
      feature: idea.feature,
      setupSteps: idea.setupSteps,
      recordingSteps: idea.recordingSteps,
      category: cat.name,
      createdAt: new Date().toISOString(),
    })),
  }));

  console.log(`[Content] Generated ${categories.length} categories with ${categories.reduce((sum, c) => sum + c.content.length, 0)} ideas`);

  return categories;
}

/**
 * Generate and save content ideas for a project
 */
import { addContentIdeas } from './video-storage.js';

export async function generateAndSaveContentIdeas(
  projectPath: string,
  options: GenerateContentOptions = {}
): Promise<ContentCategory[]> {
  const categories = await generateContentIdeas(projectPath, options);

  // Flatten categories to ideas and save
  const allIdeas: ContentIdea[] = [];
  for (const category of categories) {
    for (const idea of category.content) {
      allIdeas.push(idea);
    }
  }

  await addContentIdeas(projectPath, allIdeas);

  return categories;
}
