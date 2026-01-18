/**
 * Tests for config.ts - Configuration utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as config from '../../src/utils/config.js';
import { createTempDir, cleanupTempDir, createMockFile } from '../setup.js';

describe('getInstructionsDir', () => {
  it('should return the correct instructions directory path', () => {
    const result = config.getInstructionsDir('/test/project');
    expect(result).toBe('/test/project/.instructions');
  });
});

describe('getConfigPath', () => {
  it('should return the correct config file path', () => {
    const result = config.getConfigPath('/test/project');
    expect(result).toBe('/test/project/.instructions/config.json');
  });
});

describe('hasInstructions', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('config-has');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should return true when config exists', async () => {
    const instructionsDir = `${tempDir}/.instructions`;
    await Bun.mkdir(instructionsDir, { recursive: true });
    await createMockFile(instructionsDir, 'config.json', '{"version": "1.0.0"}');

    const result = await config.hasInstructions(tempDir);
    expect(result).toBe(true);
  });

  it('should return false when config does not exist', async () => {
    const result = await config.hasInstructions(tempDir);
    expect(result).toBe(false);
  });
});

describe('loadConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('config-load');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should load valid config file', async () => {
    const instructionsDir = `${tempDir}/.instructions`;
    await Bun.mkdir(instructionsDir, { recursive: true });

    const testConfig = {
      version: '1.0.0',
      projectPath: tempDir,
      projectType: 'expo' as const,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      preferences: {
        defaultDevice: 'iPhone 15 Pro',
        defaultUseCache: true,
        defaultClean: false,
      },
    };

    await createMockFile(instructionsDir, 'config.json', JSON.stringify(testConfig));

    const result = await config.loadConfig(tempDir);
    expect(result).toEqual(testConfig);
  });

  it('should return null when config does not exist', async () => {
    const result = await config.loadConfig(tempDir);
    expect(result).toBeNull();
  });

  it('should return null for malformed JSON', async () => {
    const instructionsDir = `${tempDir}/.instructions`;
    await Bun.mkdir(instructionsDir, { recursive: true });
    await createMockFile(instructionsDir, 'config.json', 'invalid json{{{');

    const result = await config.loadConfig(tempDir);
    expect(result).toBeNull();
  });
});

describe('saveConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('config-save');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should save config to file', async () => {
    const testConfig = {
      version: '1.0.0',
      projectPath: tempDir,
      projectType: 'react-native' as const,
      createdAt: new Date().toISOString(),
      lastUpdated: new Date().toISOString(),
      preferences: {
        defaultDevice: 'iPhone 14',
        defaultUseCache: false,
        defaultClean: true,
      },
    };

    await config.saveConfig(tempDir, testConfig);

    // Verify file was created
    const configPath = config.getConfigPath(tempDir);
    const configFile = Bun.file(configPath);
    expect(await configFile.exists()).toBe(true);

    // Verify content
    const savedConfig = await configFile.json();
    expect(savedConfig).toEqual(testConfig);
  });
});

describe('createConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('config-create');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should create config with detected project type', async () => {
    // Create a package.json to influence detection
    await createMockFile(tempDir, 'package.json', JSON.stringify({
      name: 'test-app',
      dependencies: { expo: '^50.0.0' },
    }));

    const result = await config.createConfig(tempDir);

    expect(result.projectType).toBe('expo');
    expect(result.projectPath).toBe(tempDir);
    expect(result.version).toBe('1.0.0');
    expect(result.preferences.defaultDevice).toBe('iPhone 15 Pro');
    expect(result.preferences.defaultUseCache).toBe(true);
    expect(result.preferences.defaultClean).toBe(false);
  });
});

describe('updateConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('config-update');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should update existing config', async () => {
    // Create initial config
    await config.createConfig(tempDir);

    // Update config
    const updates = {
      preferences: {
        defaultDevice: 'iPhone 14 Pro' as const,
        defaultUseCache: false,
        defaultClean: true,
      },
    };

    const result = await config.updateConfig(tempDir, updates);

    expect(result?.preferences.defaultDevice).toBe('iPhone 14 Pro');
    expect(result?.preferences.defaultUseCache).toBe(false);
    expect(result?.preferences.defaultClean).toBe(true);
  });

  it('should return null when config does not exist', async () => {
    const result = await config.updateConfig(tempDir, {});
    expect(result).toBeNull();
  });
});

describe('getPreference and setPreference', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('config-pref');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should get and set preference values', async () => {
    await config.createConfig(tempDir);

    // Get initial value
    const initialValue = await config.getPreference(tempDir, 'defaultDevice');
    expect(initialValue).toBe('iPhone 15 Pro');

    // Set new value
    await config.setPreference(tempDir, 'defaultDevice', 'iPhone 14 Pro');

    // Get updated value
    const updatedValue = await config.getPreference(tempDir, 'defaultDevice');
    expect(updatedValue).toBe('iPhone 14 Pro');
  });

  it('should return undefined for non-existent preference', async () => {
    const result = await config.getPreference(tempDir, 'nonExistent');
    expect(result).toBeUndefined();
  });

  it('should throw when setting preference on non-existent config', async () => {
    await expect(config.setPreference(tempDir, 'defaultDevice', 'iPhone 14 Pro'))
      .rejects.toThrow();
  });
});

describe('initializeInstructions', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('config-init');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should initialize instructions folder', async () => {
    await createMockFile(tempDir, 'package.json', JSON.stringify({
      name: 'test-app',
      dependencies: { expo: '^50.0.0' },
    }));

    const result = await config.initializeInstructions(tempDir);

    expect(result.projectType).toBe('expo');

    // Verify files were created
    const configPath = config.getConfigPath(tempDir);
    const gitignorePath = `${tempDir}/.instructions/.gitignore`;

    expect(await Bun.file(configPath).exists()).toBe(true);
    expect(await Bun.file(gitignorePath).exists()).toBe(true);
  });

  it('should throw when already initialized without force', async () => {
    await createMockFile(tempDir, 'package.json', JSON.stringify({
      name: 'test-app',
    }));

    await config.initializeInstructions(tempDir);

    await expect(config.initializeInstructions(tempDir)).rejects.toThrow();
  });

  it('should reinitialize when force is true', async () => {
    await createMockFile(tempDir, 'package.json', JSON.stringify({
      name: 'test-app',
    }));

    await config.initializeInstructions(tempDir);
    await expect(config.initializeInstructions(tempDir, true)).resolves.toBeDefined();
  });
});
