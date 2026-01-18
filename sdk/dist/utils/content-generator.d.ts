/**
 * Content generation utilities - Generate video ideas from project
 */
import type { ContentCategory, GenerateContentOptions } from '../types-video.js';
/**
 * Generate content ideas based on project analysis
 */
export declare function generateContentIdeas(projectPath: string, options?: GenerateContentOptions): Promise<ContentCategory[]>;
/**
 * Generate and save content ideas for a project
 */
export declare function generateAndSaveContentIdeas(projectPath: string, options?: GenerateContentOptions): Promise<ContentCategory[]>;
//# sourceMappingURL=content-generator.d.ts.map