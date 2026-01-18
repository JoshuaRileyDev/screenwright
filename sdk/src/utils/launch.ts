/**
 * App launching utilities for Expo and React Native
 */

import type { ProjectType } from '../types.js';
import { detectProjectType, getExpoAppConfig, getNativeIosProjectPath } from './detect.js';

/**
 * Build and launch Expo app on simulator
 */
export async function launchExpoApp(
  projectPath: string,
  simulatorUdid: string,
  useCache: boolean = false
): Promise<void> {
  const appConfig = await getExpoAppConfig(projectPath);

  if (!appConfig.bundleId) {
    throw new Error('Could not find bundle identifier in app.json. Please add "ios.bundleIdentifier" to your expo config.');
  }

  console.log(`Building Expo app for simulator ${simulatorUdid}...`);
  console.log(`Bundle ID: ${appConfig.bundleId}`);

  const buildProc = Bun.spawn(
    ['npx', 'expo', 'run:ios', '--device', simulatorUdid, '--configuration', 'Release'],
    {
      cwd: projectPath,
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );

  await buildProc.exited;

  if (buildProc.exitCode !== 0) {
    throw new Error('Expo build failed');
  }
}

/**
 * Build and launch React Native app on simulator
 */
export async function launchReactNativeApp(
  projectPath: string,
  simulatorUdid: string
): Promise<void> {
  console.log(`Building React Native app for simulator ${simulatorUdid}...`);

  const buildProc = Bun.spawn(
    ['npx', 'react-native', 'run-ios', '--simulator', simulatorUdid],
    {
      cwd: projectPath,
      stdout: 'inherit',
      stderr: 'inherit',
    }
  );

  await buildProc.exited;

  if (buildProc.exitCode !== 0) {
    throw new Error('React Native build failed');
  }
}

/**
 * Build and launch native iOS app on simulator
 */
export async function launchNativeIosApp(
  projectPath: string,
  simulatorUdid: string,
  scheme?: string
): Promise<void> {
  const iosProjectPath = await getNativeIosProjectPath(projectPath);

  if (!iosProjectPath) {
    throw new Error('Could not find .xcworkspace or .xcodeproj in ios directory');
  }

  console.log(`Building native iOS app for simulator ${simulatorUdid}...`);
  console.log(`Project: ${iosProjectPath}`);

  // Build and run using xcodebuild
  const buildProc = Bun.spawn([
    'xcodebuild',
    '-workspace', iosProjectPath.includes('.xcworkspace') ? iosProjectPath : iosProjectPath.replace('.xcodeproj', '.xcworkspace'),
    '-scheme', scheme || 'MyApp',
    '-sdk', 'iphonesimulator',
    '-destination', `id=${simulatorUdid}`,
    'build'
  ], {
    cwd: projectPath,
    stdout: 'inherit',
    stderr: 'inherit',
  });

  await buildProc.exited;

  if (buildProc.exitCode !== 0) {
    throw new Error('iOS build failed');
  }

  // Install and launch the app
  console.log('Installing and launching app...');

  // Find the built app
  const derivedDataPath = `${process.env.HOME}/Library/Developer/Xcode/DerivedData`;
  const findProc = Bun.spawn([
    'find',
    derivedDataPath,
    '-name',
    '*.app',
    '-path',
    '*/Build/Products/Debug-iphonesimulator/*'
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await findProc.exited;

  if (findProc.exitCode === 0) {
    const output = await new Response(findProc.stdout).text();
    const appPath = output.trim().split('\n')[0];

    if (appPath) {
      // Install the app
      const installProc = Bun.spawn(['xcrun', 'simctl', 'install', simulatorUdid, appPath], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      await installProc.exited;

      if (installProc.exitCode === 0) {
        // Get bundle ID from app
        const infoPlistPath = `${appPath}/Info.plist`;
        const bundleIdProc = Bun.spawn([
          '/usr/libexec/PlistBuddy',
          '-c',
          'Print :CFBundleIdentifier',
          infoPlistPath
        ], {
          stdout: 'pipe',
          stderr: 'pipe',
        });

        await bundleIdProc.exited;

        if (bundleIdProc.exitCode === 0) {
          const bundleId = (await new Response(bundleIdProc.stdout).text()).trim();

          // Launch the app
          const launchProc = Bun.spawn(['xcrun', 'simctl', 'launch', simulatorUdid, bundleId], {
            stdout: 'pipe',
            stderr: 'pipe',
          });

          await launchProc.exited;
        }
      }
    }
  }
}

/**
 * Generic launch function that detects project type and launches accordingly
 */
export async function launchProject(
  projectPath: string,
  simulatorUdid: string,
  projectType?: ProjectType,
  options: { useCache?: boolean; scheme?: string } = {}
): Promise<void> {
  const detectedType = projectType || await detectProjectType(projectPath);

  switch (detectedType) {
    case 'expo':
      await launchExpoApp(projectPath, simulatorUdid, options.useCache);
      break;
    case 'react-native':
      await launchReactNativeApp(projectPath, simulatorUdid);
      break;
    case 'native-ios':
      await launchNativeIosApp(projectPath, simulatorUdid, options.scheme);
      break;
    default:
      throw new Error('Unknown project type. Could not determine how to launch the app.');
  }
}
