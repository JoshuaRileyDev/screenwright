/**
 * Content Creator Agent
 * Analyzes codebases to generate user-facing tutorial video ideas
 */

import { readdir, stat } from 'node:fs/promises';
import { join, relative } from 'node:path';
import { createOpenRouterClient, type ChatMessage } from '../openrouter.js';
import { getOpenRouterApiKey, getModel } from '../config.js';
import { CONTENT_CREATOR_SYSTEM_PROMPT } from '../prompts/content-creator.js';

export interface ContentIdea {
  title: string;
  description: string;
  feature: string;
  setupSteps: string[];
  recordingSteps: string[];
}

export interface ContentCategory {
  name: string;
  description: string;
  content: ContentIdea[];
}

export interface ExistingContent {
  title: string;
  description: string;
  category?: string;
}

export interface GenerateContentOptions {
  projectPath: string;
  existingContent?: ExistingContent[];
  maxIdeas?: number;
  maxCategories?: number;
}

interface FileInfo {
  path: string;
  content: string;
  size: number;
}

/**
 * Manually explore a codebase and gather context
 */
async function exploreCodebase(projectPath: string): Promise<string> {
  console.log('[Content Creator] Exploring codebase...');

  const findings: string[] = [];
  const fileContents: FileInfo[] = [];

  // 1. Read package.json first
  try {
    const packageJsonPath = join(projectPath, 'package.json');
    const packageFile = Bun.file(packageJsonPath);
    if (await packageFile.exists()) {
      const content = await packageFile.text();
      const pkg = JSON.parse(content);
      findings.push(`## Package Information\n- Name: ${pkg.name}\n- Description: ${pkg.description || 'N/A'}\n- Dependencies: ${Object.keys(pkg.dependencies || {}).join(', ')}`);
      console.log('[Content Creator] ✓ Read package.json');
    }
  } catch {
    console.log('[Content Creator] ⚠ No package.json found');
  }

  // 2. Read README
  try {
    for (const name of ['README.md', 'readme.md', 'README.MD']) {
      const readmePath = join(projectPath, name);
      const readmeFile = Bun.file(readmePath);
      if (await readmeFile.exists()) {
        const content = await readmeFile.text();
        findings.push(`## README\n${content.substring(0, 1000)}`);
        console.log('[Content Creator] ✓ Read README.md');
        break;
      }
    }
  } catch {
    console.log('[Content Creator] ⚠ No README found');
  }

  // 3. List directory structure (with gitignore support)
  const isIgnored = await parseGitignore(projectPath);

  async function exploreDirectory(dirPath: string, depth: number = 0): Promise<void> {
    if (depth > 3) return; // Max depth 3

    try {
      const entries = await readdir(dirPath);

      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const relativePath = relative(projectPath, fullPath);

        if (isIgnored(relativePath)) continue;

        try {
          const stats = await stat(fullPath);

          if (stats.isDirectory()) {
            findings.push(`📁 ${relativePath}/`);
            await exploreDirectory(fullPath, depth + 1);
          } else if (stats.isFile()) {
            // Read important files
            if (/\.(tsx?|jsx?|json|md)$/.test(entry) && stats.size < 100000) {
              const file = Bun.file(fullPath);
              const content = await file.text();
              fileContents.push({
                path: relativePath,
                content: content.substring(0, 2000), // First 2000 chars
                size: stats.size,
              });
              findings.push(`📄 ${relativePath} (${stats.size} bytes)`);
            } else {
              findings.push(`📄 ${relativePath} (${stats.size} bytes)`);
            }
          }
        } catch {
          // Skip files we can't access
          continue;
        }
      }
    } catch {
      // Skip directories we can't read
      return;
    }
  }

  await exploreDirectory(projectPath);

  // 4. Build comprehensive summary
  let summary = `# Codebase Exploration Results\n\n`;
  summary += findings.join('\n');
  summary += `\n\n## Key File Contents\n\n`;

  for (const file of fileContents.slice(0, 20)) { // Max 20 files
    summary += `### ${file.path}\n\`\`\`\n${file.content}\n\`\`\`\n\n`;
  }

  console.log(`[Content Creator] ✓ Explored ${findings.length} items, read ${fileContents.length} files`);

  return summary;
}

/**
 * Parse .gitignore for file filtering
 */
async function parseGitignore(basePath: string): Promise<(path: string) => boolean> {
  const { readFile } = await import('node:fs/promises');
  const gitignorePath = join(basePath, '.gitignore');

  try {
    const content = await readFile(gitignorePath, 'utf-8');
    const patterns = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'));

    return (path: string) => {
      // Always ignore common directories
      if (path.includes('node_modules') ||
          path.includes('.git/') ||
          path.includes('dist/') ||
          path.includes('out/') ||
          path.includes('.claude/')) {
        return true;
      }

      // Check against gitignore patterns
      return patterns.some(pattern => {
        // Simple pattern matching
        if (pattern.endsWith('/')) {
          // Directory pattern
          const dirPattern = pattern.slice(0, -1);
          return path.startsWith(dirPattern) || path.includes(`/${dirPattern}`);
        }

        if (pattern.startsWith('*')) {
          // Wildcard pattern
          const extension = pattern.slice(1);
          return path.endsWith(extension);
        }

        // Exact match or contains
        return path === pattern || path.includes(pattern) || path.endsWith(pattern);
      });
    };
  } catch {
    // If no .gitignore, just filter common paths
    return (path: string) =>
      path.includes('node_modules') ||
      path.includes('.git/') ||
      path.includes('dist/') ||
      path.includes('out/') ||
      path.includes('.claude/');
  }
}

/**
 * Zod schema for structured output (compatible with AI SDK)
 */
const contentIdeaSchema = {
  type: 'object' as const,
  properties: {
    title: {
      type: 'string' as const,
      description: 'Clear, user-friendly title (5-10 words). Frame as "How to..." or "[Action] [Feature]". Example: "How to Create Your First Post" or "Customizing Notification Settings"',
    },
    description: {
      type: 'string' as const,
      description: '2-3 sentence description from USER perspective. What will the user learn to DO? What task will they accomplish? NO technical details.',
    },
    feature: {
      type: 'string' as const,
      description: 'The user-facing feature or capability being demonstrated (not code/technical terms)',
    },
    setupSteps: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Navigation from app home screen to starting screen. App is ALREADY OPEN. Do NOT include "Open the app". Use empty array [] if video starts at home screen. Example: ["Tap the Settings icon in bottom navigation", "Scroll to Notifications section"]. Be specific about button/icon names.',
    },
    recordingSteps: {
      type: 'array' as const,
      items: { type: 'string' as const },
      description: 'Step-by-step actions to perform DURING the screen recording. Example: ["Tap the toggle switch next to Push Notifications", "Observe the toggle turns blue/on", "Tap the back button to save"]. Be specific and include expected UI feedback.',
    },
  },
  required: ['title', 'description', 'feature', 'setupSteps', 'recordingSteps'],
};

const contentCategorySchema = {
  type: 'object' as const,
  properties: {
    name: {
      type: 'string' as const,
      description: 'Category name. Use "Getting Started" for intro, "Settings & Customization" for preferences, or task-based names like "Creating Content" or "Managing Your Profile".',
    },
    description: {
      type: 'string' as const,
      description: 'Brief description of what users will learn in this category and why it helps them',
    },
    content: {
      type: 'array' as const,
      items: contentIdeaSchema,
      description: 'Array of 2-4 user-focused tutorial ideas in this category',
    },
  },
  required: ['name', 'description', 'content'],
};

const categoriesSchema = {
  type: 'object' as const,
  properties: {
    categories: {
      type: 'array' as const,
      items: contentCategorySchema,
      description: 'Array of content categories',
    },
  },
  required: ['categories'],
};

/**
 * Generate content ideas using AI
 */
export async function generateContentIdeas(
  options: GenerateContentOptions
): Promise<ContentCategory[]> {
  const {
    projectPath,
    existingContent = [],
    maxIdeas = 10,
    maxCategories = 3,
  } = options;

  console.log(`[Content Creator] Starting generation for ${projectPath}`);
  console.log(`[Content Creator] Target: ${maxIdeas} ideas in ${maxCategories} categories`);

  // Step 1: Explore the codebase
  const explorationSummary = await exploreCodebase(projectPath);
  console.log(`[Content Creator] Exploration summary length: ${explorationSummary.length} chars`);

  // Step 2: Get AI config
  const [apiKey, model] = await Promise.all([
    getOpenRouterApiKey(),
    getModel('content-creator'),
  ]);
  console.log(`[Content Creator] Using model: ${model}`);

  // Step 2: Generate structured content ideas based on exploration
  const generationPrompt = `Based on the following codebase exploration, generate ${maxIdeas} END-USER tutorial video ideas organized into ${maxCategories} categories.

CRITICAL: These videos teach APP USERS how to USE the application, NOT developers how to code it.

## Codebase Analysis:
${explorationSummary}

${existingContent.length > 0 ? `
IMPORTANT: Avoid duplicating these existing content ideas:
${existingContent.map((item, i) => `${i + 1}. "${item.title}" - ${item.description}${item.category ? ` (Category: ${item.category})` : ''}`).join('\n')}
` : ''}

Required category structure:
1. FIRST: "Getting Started" (1-2 videos) - What the app does, basic navigation, first-time setup
2. IF APPLICABLE: "Settings & Customization" (1-2 videos) - Only if app has user-configurable settings
3. REMAINING: Task-based categories (2-4 videos each) - Organized by what users want to accomplish

Focus on USER TASKS and WORKFLOWS:
- Think: "What does a user want to DO with this app?"
- Frame as: "How to [accomplish task]" or "Creating/Managing/Using [feature]"
- Examples: "Creating Your First Post", "Finding Friends", "Customizing Notifications"
- NOT: "Understanding Components", "API Integration", "Code Architecture"

CRITICAL - Recording Instructions:
For EACH video idea, provide:
1. **setupSteps**: Navigation from app home screen to the starting screen
   - IMPORTANT: App is already open at the home/main screen
   - Do NOT include "Open the app" as a step
   - Start from wherever the app lands after opening
   - Be specific: "Tap the Settings icon (gear icon) in bottom right" not "Go to settings"
   - If video starts at home screen, setupSteps can be empty array: []
   - Example: ["Tap the + button in bottom center", "Select 'New Post' from menu"]

2. **recordingSteps**: Actions to perform during the screen recording
   - Be specific about what to tap/type/swipe
   - Include expected UI feedback: "Toggle turns blue", "Success message appears"
   - Example: ["Tap in the title field", "Type 'My First Post'", "Tap the camera icon", "Select a photo", "Tap 'Post' button", "Confirm post appears in feed"]

Granularity balance:
- Each video = ONE complete USER TASK or FEATURE
- Don't split simple tasks into multiple videos (too granular)
- Don't combine complex workflows into one video (too broad)
- Think: "Can a user accomplish something meaningful after watching this 5-10 minute video?"

Avoid:
- Technical/developer language (API, components, implementation, code structure)
- Duplicating the existing content ideas listed above
- Features users never interact with directly
- Vague instructions like "Navigate to settings" (be specific: "Tap Settings icon in bottom navigation")`;

  console.log('[Content Creator] Calling OpenRouter API...');

  try {
    const client = createOpenRouterClient(apiKey);

    const messages: ChatMessage[] = [
      { role: 'system', content: CONTENT_CREATOR_SYSTEM_PROMPT },
      { role: 'user', content: generationPrompt },
    ];

    // Using JSON mode for structured output
    const result = await client.chatJSON<{ categories: ContentCategory[] }>({
      model,
      messages,
      response_format: { type: 'json_object' },
    });

    console.log('[Content Creator] Generation complete!');
    console.log(`[Content Creator] Generated ${result.categories.length} categories`);

    // Log category details
    result.categories.forEach((cat, i) => {
      console.log(`[Content Creator] Category ${i + 1}: "${cat.name}" with ${cat.content.length} ideas`);
      cat.content.forEach((idea, j) => {
        console.log(`[Content Creator]   ${j + 1}. "${idea.title}"`);
      });
    });

    // Apply deduplication filter across all categories
    const deduplicatedCategories = result.categories.map(category => ({
      ...category,
      content: deduplicateIdeas(category.content, existingContent),
    })).filter(category => category.content.length > 0); // Remove empty categories

    console.log(`[Content Creator] After deduplication: ${deduplicatedCategories.length} categories`);
    console.log('[Content Creator] ✅ Generation successful!');

    return deduplicatedCategories.slice(0, maxCategories);
  } catch (error) {
    console.error('[Content Creator] ❌ Error during generation:', error);
    throw error;
  }
}

/**
 * Deduplicate ideas by comparing with existing content
 */
function deduplicateIdeas(
  newIdeas: ContentIdea[],
  existing: ExistingContent[]
): ContentIdea[] {
  return newIdeas.filter(newIdea => {
    // Check for similar titles (simple word overlap)
    const isDuplicate = existing.some(existingItem => {
      const newWords = new Set(newIdea.title.toLowerCase().split(/\s+/));
      const existingWords = new Set(existingItem.title.toLowerCase().split(/\s+/));

      // Count overlapping words
      const overlap = [...newWords].filter(word => existingWords.has(word));
      const similarity = overlap.length / Math.max(newWords.size, existingWords.size);

      return similarity > 0.6; // 60% word overlap = likely duplicate
    });

    return !isDuplicate;
  });
}
