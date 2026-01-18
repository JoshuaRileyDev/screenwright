/**
 * Tests for detect.ts - Project type detection utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as detect from '../../src/utils/detect.js';
import { createTempDir, cleanupTempDir, createMockPackageJson, createMockAppJson, createMockFile } from '../setup.js';

describe('detectProjectType', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('detect');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should detect Expo project from package.json dependencies', async () => {
    await createMockPackageJson(tempDir, {
      name: 'test-expo-app',
      dependencies: { expo: '^50.0.0' },
    });

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('expo');
  });

  it('should detect Expo project from devDependencies', async () => {
    await createMockPackageJson(tempDir, {
      name: 'test-expo-app',
      devDependencies: { expo: '^50.0.0' },
    });

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('expo');
  });

  it('should detect React Native project from dependencies', async () => {
    await createMockPackageJson(tempDir, {
      name: 'test-rn-app',
      dependencies: { 'react-native': '^0.73.0' },
    });

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('react-native');
  });

  it('should detect React Native project from devDependencies', async () => {
    await createMockPackageJson(tempDir, {
      name: 'test-rn-app',
      devDependencies: { 'react-native': '^0.73.0' },
    });

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('react-native');
  });

  it('should prioritize Expo over React Native when both are present', async () => {
    await createMockPackageJson(tempDir, {
      name: 'test-expo-rn-app',
      dependencies: { expo: '^50.0.0', 'react-native': '^0.73.0' },
    });

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('expo');
  });

  it('should detect Expo project from app.json', async () => {
    await createMockAppJson(tempDir, {
      expo: { name: 'Test App', slug: 'test-app' },
    });

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('expo');
  });

  it('should detect native iOS project from .xcodeproj', async () => {
    // Create ios directory structure
    const iosDir = `${tempDir}/ios`;
    await Bun.mkdir(iosDir, { recursive: true });
    await createMockFile(iosDir, 'TestApp.xcodeproj/project.pbxproj', '// Mock project file');

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('native-ios');
  });

  it('should detect native iOS project from .xcworkspace', async () => {
    // Create ios directory structure with workspace
    const iosDir = `${tempDir}/ios`;
    await Bun.mkdir(iosDir, { recursive: true });
    await createMockFile(iosDir, 'TestApp.xcworkspace/contents.xcworkspacedata', '// Mock workspace file');

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('native-ios');
  });

  it('should return unknown for unrecognized project type', async () => {
    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('unknown');
  });

  it('should handle missing package.json gracefully', async () => {
    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('unknown');
  });
});

describe('getExpoAppConfig', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('expo-config');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should extract scheme and bundleId from app.json', async () => {
    await createMockAppJson(tempDir, {
      expo: {
        name: 'Test App',
        scheme: 'testapp',
        ios: {
          bundleIdentifier: 'com.test.app',
        },
      },
    });

    const result = await detect.getExpoAppConfig(tempDir);
    expect(result).toEqual({
      scheme: 'testapp',
      bundleId: 'com.test.app',
    });
  });

  it('should return null values when app.json is missing', async () => {
    const result = await detect.getExpoAppConfig(tempDir);
    expect(result).toEqual({
      scheme: null,
      bundleId: null,
    });
  });

  it('should return null for missing properties', async () => {
    await createMockAppJson(tempDir, {
      expo: {
        name: 'Test App',
      },
    });

    const result = await detect.getExpoAppConfig(tempDir);
    expect(result).toEqual({
      scheme: null,
      bundleId: null,
    });
  });

  it('should handle malformed app.json gracefully', async () => {
    await createMockFile(tempDir, 'app.json', 'invalid json{{{');

    const result = await detect.getExpoAppConfig(tempDir);
    expect(result).toEqual({
      scheme: null,
      bundleId: null,
    });
  });
});

describe('getNativeIosProjectPath', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('native-ios');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should return null when no iOS directory exists', async () => {
    const result = await detect.getNativeIosProjectPath(tempDir);
    expect(result).toBeNull();
  });

  // Note: Full integration tests for findFile/getNativeIosProjectPath would require
  // actual file system operations which are mocked by Bun.spawn in the implementation
  // These are best tested with integration tests
});

describe('Project type detection priorities', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('priorities');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  it('should prioritize native iOS detection over package.json', async () => {
    // Create iOS directory structure
    const iosDir = `${tempDir}/ios`;
    await Bun.mkdir(iosDir, { recursive: true });
    await createMockFile(iosDir, 'TestApp.xcodeproj/project.pbxproj', '// Mock project file');

    // Also create package.json with expo
    await createMockPackageJson(tempDir, {
      name: 'test-hybrid',
      dependencies: { expo: '^50.0.0' },
    });

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('native-ios');
  });

  it('should detect Expo when both RN and Expo are in dependencies', async () => {
    await createMockPackageJson(tempDir, {
      name: 'test-expo-rn',
      dependencies: {
        expo: '^50.0.0',
        'react-native': '^0.73.0',
      },
    });

    const result = await detect.detectProjectType(tempDir);
    expect(result).toBe('expo');
  });
});
