/**
 * Configuration utilities for managing .instructions folder
 */

import type { InstructionsConfig, ProjectType } from '../types.js';
import { detectProjectType } from './detect.js';

const INSTRUCTIONS_DIR = '.instructions';
const CONFIG_FILE = 'config.json';

/**
 * Get the instructions directory path for a project
 */
export function getInstructionsDir(projectPath: string): string {
  return `${projectPath}/${INSTRUCTIONS_DIR}`;
}

/**
 * Get the config file path for a project
 */
export function getConfigPath(projectPath: string): string {
  return `${getInstructionsDir(projectPath)}/${CONFIG_FILE}`;
}

/**
 * Check if .instructions folder exists
 */
export async function hasInstructions(projectPath: string): Promise<boolean> {
  const configPath = getConfigPath(projectPath);
  const configFile = Bun.file(configPath);
  return await configFile.exists();
}

/**
 * Load the instructions config
 */
export async function loadConfig(projectPath: string): Promise<InstructionsConfig | null> {
  const configPath = getConfigPath(projectPath);
  const configFile = Bun.file(configPath);

  if (!await configFile.exists()) {
    return null;
  }

  try {
    return await configFile.json();
  } catch {
    return null;
  }
}

/**
 * Save the instructions config
 */
export async function saveConfig(projectPath: string, config: InstructionsConfig): Promise<void> {
  const instructionsDir = getInstructionsDir(projectPath);
  const configPath = getConfigPath(projectPath);

  // Create directory if it doesn't exist
  const mkdirProc = Bun.spawn(['mkdir', '-p', instructionsDir], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await mkdirProc.exited;

  if (mkdirProc.exitCode !== 0) {
    throw new Error('Failed to create .instructions directory');
  }

  // Write config file
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}

/**
 * Create initial instructions config
 */
export async function createConfig(projectPath: string): Promise<InstructionsConfig> {
  const projectType = await detectProjectType(projectPath);
  const now = new Date().toISOString();

  const config: InstructionsConfig = {
    version: '1.0.0',
    projectPath,
    projectType,
    createdAt: now,
    lastUpdated: now,
    preferences: {
      defaultDevice: 'iPhone 15 Pro',
      defaultUseCache: true,
      defaultClean: false,
    },
  };

  await saveConfig(projectPath, config);
  return config;
}

/**
 * Update the instructions config
 */
export async function updateConfig(
  projectPath: string,
  updates: Partial<InstructionsConfig>
): Promise<InstructionsConfig | null> {
  const config = await loadConfig(projectPath);

  if (!config) {
    return null;
  }

  const updatedConfig = {
    ...config,
    ...updates,
    lastUpdated: new Date().toISOString(),
  };

  await saveConfig(projectPath, updatedConfig);
  return updatedConfig;
}

/**
 * Get a preference value from config
 */
export async function getPreference<K extends keyof InstructionsConfig['preferences']>(
  projectPath: string,
  key: K
): Promise<InstructionsConfig['preferences'][K] | undefined> {
  const config = await loadConfig(projectPath);
  return config?.preferences[key];
}

/**
 * Set a preference value in config
 */
export async function setPreference<K extends keyof InstructionsConfig['preferences']>(
  projectPath: string,
  key: K,
  value: InstructionsConfig['preferences'][K]
): Promise<void> {
  const config = await loadConfig(projectPath);

  if (!config) {
    throw new Error('No .instructions config found. Run `screenwright init` first.');
  }

  config.preferences[key] = value;
  config.lastUpdated = new Date().toISOString();

  await saveConfig(projectPath, config);
}

/**
 * Create default .gitignore for .instructions folder
 */
export async function createGitIgnore(projectPath: string): Promise<void> {
  const gitignorePath = `${getInstructionsDir(projectPath)}/.gitignore`;

  const content = `# Dev Launcher - Instructions Folder
# This folder contains local development preferences and cache

# Ignore cache files
cache/

# Ignore temporary files
*.tmp
*.log
`;

  await Bun.write(gitignorePath, content);
}

/**
 * Initialize .instructions folder for a project
 */
export async function initializeInstructions(projectPath: string, force: boolean = false): Promise<InstructionsConfig> {
  const instructionsDir = getInstructionsDir(projectPath);

  // Check if already initialized
  if (!force && await hasInstructions(projectPath)) {
    const config = await loadConfig(projectPath);
    throw new Error(`Project already initialized. Found existing .instructions folder.\n` +
      `Project type: ${config?.projectType}\n` +
      `Use --force to reinitialize.`);
  }

  // Create the config
  const config = await createConfig(projectPath);

  // Create .gitignore
  await createGitIgnore(projectPath);

  return config;
}
