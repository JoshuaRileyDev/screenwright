/**
 * Project type detection utilities
 */
import type { ProjectType, AppConfig } from '../types.js';
/**
 * Detect if project is Expo, React Native, or Native iOS
 */
export declare function detectProjectType(projectPath: string): Promise<ProjectType>;
/**
 * Get Expo app configuration from app.json
 */
export declare function getExpoAppConfig(projectPath: string): Promise<AppConfig>;
/**
 * Get the iOS project path for native iOS projects
 */
export declare function getNativeIosProjectPath(projectPath: string): Promise<string | null>;
//# sourceMappingURL=detect.d.ts.map