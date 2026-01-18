/**
 * Configuration utilities for managing .instructions folder
 */
import type { InstructionsConfig } from '../types.js';
/**
 * Get the instructions directory path for a project
 */
export declare function getInstructionsDir(projectPath: string): string;
/**
 * Get the config file path for a project
 */
export declare function getConfigPath(projectPath: string): string;
/**
 * Check if .instructions folder exists
 */
export declare function hasInstructions(projectPath: string): Promise<boolean>;
/**
 * Load the instructions config
 */
export declare function loadConfig(projectPath: string): Promise<InstructionsConfig | null>;
/**
 * Save the instructions config
 */
export declare function saveConfig(projectPath: string, config: InstructionsConfig): Promise<void>;
/**
 * Create initial instructions config
 */
export declare function createConfig(projectPath: string): Promise<InstructionsConfig>;
/**
 * Update the instructions config
 */
export declare function updateConfig(projectPath: string, updates: Partial<InstructionsConfig>): Promise<InstructionsConfig | null>;
/**
 * Get a preference value from config
 */
export declare function getPreference<K extends keyof InstructionsConfig['preferences']>(projectPath: string, key: K): Promise<InstructionsConfig['preferences'][K] | undefined>;
/**
 * Set a preference value in config
 */
export declare function setPreference<K extends keyof InstructionsConfig['preferences']>(projectPath: string, key: K, value: InstructionsConfig['preferences'][K]): Promise<void>;
/**
 * Create default .gitignore for .instructions folder
 */
export declare function createGitIgnore(projectPath: string): Promise<void>;
/**
 * Initialize .instructions folder for a project
 */
export declare function initializeInstructions(projectPath: string, force?: boolean): Promise<InstructionsConfig>;
//# sourceMappingURL=config.d.ts.map