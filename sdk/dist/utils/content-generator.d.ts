/**
 * Content generation utilities - Generate video ideas from project
 *
 * Uses AI-powered content analysis via OpenRouter to generate
 * user-focused tutorial video ideas from codebases.
 */
import type { ContentCategory, GenerateContentOptions } from '../types-video.js';
/**
 * Generate content ideas based on AI-powered codebase analysis
 *
 * This function uses the Content Creator AI agent to analyze the codebase
 * and generate user-facing tutorial video ideas.
 */
export declare function generateContentIdeas(projectPath: string, options?: GenerateContentOptions): Promise<ContentCategory[]>;
export declare function generateAndSaveContentIdeas(projectPath: string, options?: GenerateContentOptions): Promise<ContentCategory[]>;
//# sourceMappingURL=content-generator.d.ts.map