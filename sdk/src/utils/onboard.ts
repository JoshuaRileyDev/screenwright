/**
 * Onboarding utilities for Screenwright CLI
 *
 * Checks for required tools, installs if missing, and collects API keys
 */

import { mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { homedir } from 'node:os';

const SCREENWRIGHT_DIR = join(homedir(), '.screenwright');
const CONFIG_FILE = join(SCREENWRIGHT_DIR, 'config.json');

export interface OnboardConfig {
  openrouterApiKey?: string;
  elevenlabsApiKey?: string;
  onboardedAt: string;
}

export interface ToolCheck {
  name: string;
  installed: boolean;
  version?: string;
  required: boolean;
  installCommand?: string;
  autoInstall?: () => Promise<boolean>;
}

/**
 * Get the onboard config file path
 */
export function getOnboardConfigPath(): string {
  return CONFIG_FILE;
}

/**
 * Load onboard config
 */
export async function loadOnboardConfig(): Promise<OnboardConfig | null> {
  try {
    const file = Bun.file(CONFIG_FILE);
    if (!await file.exists()) {
      return null;
    }
    return await file.json();
  } catch {
    return null;
  }
}

/**
 * Save onboard config
 */
export async function saveOnboardConfig(config: OnboardConfig): Promise<void> {
  await mkdir(SCREENWRIGHT_DIR, { recursive: true });
  await Bun.write(CONFIG_FILE, JSON.stringify(config, null, 2));
}

/**
 * Check if Xcode is installed
 */
export async function checkXcode(): Promise<ToolCheck> {
  try {
    const proc = Bun.spawn(['xcode-select', '-p'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    if (proc.exitCode === 0) {
      const path = await new Response(proc.stdout).text();
      return {
        name: 'Xcode',
        installed: true,
        version: path.trim(),
        required: true,
      };
    }
  } catch {
    // Continue to return not installed
  }

  return {
    name: 'Xcode',
    installed: false,
    required: true,
    installCommand: 'xcode-select --install',
    autoInstall: async () => {
      console.log('Opening App Store to install Xcode Command Line Tools...');
      console.log('Please complete the installation in the dialog that appears.');
      const proc = Bun.spawn(['xcode-select', '--install'], {
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
      return proc.exitCode === 0;
    },
  };
}

/**
 * Check if simctl is available
 */
export async function checkSimctl(): Promise<ToolCheck> {
  try {
    const proc = Bun.spawn(['xcrun', 'simctl', 'list'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    return {
      name: 'simctl',
      installed: proc.exitCode === 0,
      required: true,
    };
  } catch {
    return {
      name: 'simctl',
      installed: false,
      required: true,
    };
  }
}

/**
 * Check if FFmpeg is installed
 */
export async function checkFfmpeg(): Promise<ToolCheck> {
  try {
    const proc = Bun.spawn(['ffmpeg', '-version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    if (proc.exitCode === 0) {
      const output = await new Response(proc.stdout).text();
      const versionMatch = output.match(/ffmpeg version (\S+)/);
      return {
        name: 'FFmpeg',
        installed: true,
        version: versionMatch?.[1] || 'unknown',
        required: true,
      };
    }
  } catch {
    // Continue
  }

  return {
    name: 'FFmpeg',
    installed: false,
    required: true,
    installCommand: 'brew install ffmpeg',
    autoInstall: async () => {
      console.log('Installing FFmpeg via Homebrew...');
      const proc = Bun.spawn(['brew', 'install', 'ffmpeg'], {
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
      return proc.exitCode === 0;
    },
  };
}

/**
 * Check if AXe CLI is installed
 */
export async function checkAxe(): Promise<ToolCheck> {
  try {
    const proc = Bun.spawn(['axe', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    if (proc.exitCode === 0) {
      const output = await new Response(proc.stdout).text();
      return {
        name: 'AXe CLI',
        installed: true,
        version: output.trim() || 'unknown',
        required: true,
      };
    }
  } catch {
    // Continue
  }

  return {
    name: 'AXe CLI',
    installed: false,
    required: true,
    installCommand: 'npm install -g @axe-devtools/cli',
    autoInstall: async () => {
      console.log('Installing AXe CLI globally via npm...');
      const proc = Bun.spawn(['npm', 'install', '-g', '@axe-devtools/cli'], {
        stdout: 'inherit',
        stderr: 'inherit',
      });
      await proc.exited;
      return proc.exitCode === 0;
    },
  };
}

/**
 * Check if Homebrew is installed
 */
export async function checkHomebrew(): Promise<ToolCheck> {
  try {
    const proc = Bun.spawn(['brew', '--version'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    await proc.exited;

    if (proc.exitCode === 0) {
      const output = await new Response(proc.stdout).text();
      return {
        name: 'Homebrew',
        installed: true,
        version: output.trim() || 'unknown',
        required: false,
      };
    }
  } catch {
    // Continue
  }

  return {
    name: 'Homebrew',
    installed: false,
    required: false,
    installCommand: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"',
  };
}

/**
 * Run all tool checks
 */
export async function checkAllTools(): Promise<ToolCheck[]> {
  const results = await Promise.all([
    checkXcode(),
    checkSimctl(),
    checkFfmpeg(),
    checkAxe(),
    checkHomebrew(),
  ]);

  return results;
}

/**
 * Check if all required tools are installed
 */
export async function hasAllRequiredTools(): Promise<boolean> {
  const checks = await checkAllTools();
  return checks.filter(c => c.required).every(c => c.installed);
}

/**
 * Prompt user for API keys
 */
export async function promptForApiKeys(): Promise<{ openrouter?: string; elevenlabs?: string }> {
  const keys: { openrouter?: string; elevenlabs?: string } = {};

  console.log('\n' + '='.repeat(50));
  console.log('API Keys Configuration');
  console.log('='.repeat(50));
  console.log('\nDev Launcher uses AI services for video creation.');
  console.log('You can skip these now and add them later.\n');

  // OpenRouter API Key
  console.log('OpenRouter API Key (for AI planning and script generation)');
  console.log('  Get your key at: https://openrouter.ai/keys');
  console.log('  This is used for: Planning, Script generation');
  console.log('  Cost: ~$0.01 per video (varies by model)');

  const openrouterKey = await promptSecret('Enter OpenRouter API Key (or press Enter to skip): ');
  if (openrouterKey.trim()) {
    keys.openrouter = openrouterKey.trim();
  }

  // ElevenLabs API Key
  console.log('\nElevenLabs API Key (for AI voiceover generation)');
  console.log('  Get your key at: https://elevenlabs.io/app/settings/api-keys');
  console.log('  This is used for: Voiceover audio generation');
  console.log('  Cost: ~$0.30 per 1k characters (varies by voice)');

  const elevenlabsKey = await promptSecret('Enter ElevenLabs API Key (or press Enter to skip): ');
  if (elevenlabsKey.trim()) {
    keys.elevenlabs = elevenlabsKey.trim();
  }

  return keys;
}

/**
 * Simple prompt for secrets (doesn't echo input)
 */
async function promptSecret(question: string): Promise<string> {
  // Use read with -s flag for silent input
  const proc = Bun.spawn([
    'bash',
    '-c',
    `read -s -p "${question}" && echo "$REPLY"`
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  const output = await new Response(proc.stdout).text();
  console.log(); // Add newline after input
  return output.trim();
}

/**
 * Validate an API key format
 */
export function validateApiKey(key: string, service: 'openrouter' | 'elevenlabs'): boolean {
  if (!key) return false;

  switch (service) {
    case 'openrouter':
      // OpenRouter keys typically start with 'sk-or-'
      return key.length > 20;
    case 'elevenlabs':
      // ElevenLabs keys are typically long strings
      return key.length > 20;
    default:
      return key.length > 10;
  }
}

/**
 * Get environment variable from config
 */
export async function loadApiKeyToEnv(service: 'openrouter' | 'elevenlabs'): Promise<boolean> {
  const config = await loadOnboardConfig();
  if (!config) return false;

  const key = service === 'openrouter' ? config.openrouterApiKey : config.elevenlabsApiKey;
  if (!key) return false;

  const envVar = service === 'openrouter' ? 'OPENROUTER_API_KEY' : 'ELEVENLABS_API_KEY';
  process.env[envVar] = key;
  return true;
}

/**
 * Load all API keys to environment
 */
export async function loadAllApiKeysToEnv(): Promise<void> {
  await loadApiKeyToEnv('openrouter');
  await loadApiKeyToEnv('elevenlabs');
}
