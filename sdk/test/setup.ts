/**
 * Test Setup and Mocks
 *
 * Provides common test utilities and mocks for SDK tests
 */

import { mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a temporary directory for testing
 */
export async function createTempDir(testName: string): Promise<string> {
  const dir = join(tmpdir(), `screenwright-test-${testName}-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Clean up a temporary directory
 */
export async function cleanupTempDir(dir: string): Promise<void> {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Create a mock package.json file
 */
export async function createMockPackageJson(
  dir: string,
  content: Record<string, unknown>
): Promise<void> {
  const packageJsonPath = join(dir, 'package.json');
  await Bun.write(packageJsonPath, JSON.stringify(content, null, 2));
}

/**
 * Create a mock app.json file for Expo
 */
export async function createMockAppJson(
  dir: string,
  content: Record<string, unknown>
): Promise<void> {
  const appJsonPath = join(dir, 'app.json');
  await Bun.write(appJsonPath, JSON.stringify(content, null, 2));
}

/**
 * Create a mock file with content
 */
export async function createMockFile(
  dir: string,
  filename: string,
  content: string
): Promise<void> {
  const filePath = join(dir, filename);
  await Bun.write(filePath, content);
}

/**
 * Mock spawn result for Bun.spawn
 */
export interface MockSpawnResult {
  stdout: string;
  stderr: string;
  exitCode: number;
}

/**
 * Create a mock spawn function
 */
export function mockSpawn(results: MockSpawnResult[] | (() => MockSpawnResult)) {
  let callCount = 0;
  const isArray = Array.isArray(results);

  return async (args: string[], options?: Record<string, unknown>) => {
    const result = isArray
      ? (results as MockSpawnResult[])[callCount++ % (results as MockSpawnResult[]).length]
      : (results as () => MockSpawnResult)();

    return {
      stdout: new Response(result.stdout),
      stderr: new Response(result.stderr),
      exited: Promise.resolve(result.exitCode),
      exitCode: result.exitCode,
    };
  };
}

/**
 * Wait for a specified amount of time
 */
export async function wait(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Mock file system for testing
 */
export class MockFileSystem {
  private files = new Map<string, string>();

  setFile(path: string, content: string): void {
    this.files.set(path, content);
  }

  getFile(path: string): string | undefined {
    return this.files.get(path);
  }

  hasFile(path: string): boolean {
    return this.files.has(path);
  }

  async exists(path: string): Promise<boolean> {
    return this.files.has(path);
  }

  async readFile(path: string): Promise<string> {
    const content = this.files.get(path);
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  clear(): void {
    this.files.clear();
  }
}
