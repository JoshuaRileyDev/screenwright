/**
 * Project type detection utilities
 */

import type { ProjectType, AppConfig } from '../types.js';

/**
 * Detect if project is Expo, React Native, or Native iOS
 */
export async function detectProjectType(projectPath: string): Promise<ProjectType> {
  // Check for native iOS project first (look for .xcodeproj or .xcworkspace)
  const iosDirExists = await fileExists(`${projectPath}/ios`);
  if (iosDirExists) {
    // Check for Xcode project files
    const xcodeProjExists = await findFile(projectPath, '.xcodeproj');
    const xcworkspaceExists = await findFile(projectPath, '.xcworkspace');

    if (xcodeProjExists || xcworkspaceExists) {
      return 'native-ios';
    }
  }

  // Check for Expo/React Native via package.json
  const packageJsonPath = `${projectPath}/package.json`;
  const packageJsonExists = await fileExists(packageJsonPath);

  if (packageJsonExists) {
    try {
      const packageFile = Bun.file(packageJsonPath);
      const packageJson = await packageFile.json();

      if (packageJson.dependencies?.expo || packageJson.devDependencies?.expo) {
        return 'expo';
      }

      if (packageJson.dependencies?.['react-native'] || packageJson.devDependencies?.['react-native']) {
        return 'react-native';
      }
    } catch {
      // Continue to check for Expo config files
    }
  }

  // Check for Expo config files
  const expoConfigFiles = ['app.json', 'app.config.js', 'app.config.ts'];
  for (const configFile of expoConfigFiles) {
    if (await fileExists(`${projectPath}/${configFile}`)) {
      return 'expo';
    }
  }

  return 'unknown';
}

/**
 * Get Expo app configuration from app.json
 */
export async function getExpoAppConfig(projectPath: string): Promise<AppConfig> {
  try {
    const appJsonPath = `${projectPath}/app.json`;
    const appJsonFile = Bun.file(appJsonPath);

    if (await appJsonFile.exists()) {
      const appJson = await appJsonFile.json();
      return {
        scheme: appJson.expo?.scheme || null,
        bundleId: appJson.expo?.ios?.bundleIdentifier || null,
      };
    }
  } catch {
    // Return default config
  }
  return { scheme: null, bundleId: null };
}

/**
 * Check if a file exists
 */
async function fileExists(path: string): Promise<boolean> {
  try {
    const file = Bun.file(path);
    return await file.exists();
  } catch {
    return false;
  }
}

/**
 * Find a file with extension in directory tree
 */
async function findFile(dir: string, extension: string): Promise<boolean> {
  try {
    const proc = Bun.spawn(['find', dir, '-name', `*${extension}`, '-maxdepth', '3'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Get the iOS project path for native iOS projects
 */
export async function getNativeIosProjectPath(projectPath: string): Promise<string | null> {
  // Check for .xcworkspace first (preferred for CocoaPods)
  const workspaceProc = Bun.spawn(['find', `${projectPath}/ios`, '-name', '*.xcworkspace', '-maxdepth', '2'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await workspaceProc.exited;
  if (workspaceProc.exitCode === 0) {
    const output = await new Response(workspaceProc.stdout).text();
    const workspacePath = output.trim().split('\n')[0];
    if (workspacePath) {
      return workspacePath;
    }
  }

  // Fall back to .xcodeproj
  const projectProc = Bun.spawn(['find', `${projectPath}/ios`, '-name', '*.xcodeproj', '-maxdepth', '2'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await projectProc.exited;
  if (projectProc.exitCode === 0) {
    const output = await new Response(projectProc.stdout).text();
    const projectPath = output.trim().split('\n')[0];
    if (projectPath) {
      return projectPath;
    }
  }

  return null;
}
