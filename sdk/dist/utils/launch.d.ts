/**
 * App launching utilities for Expo and React Native
 */
import type { ProjectType } from '../types.js';
/**
 * Build and launch Expo app on simulator
 */
export declare function launchExpoApp(projectPath: string, simulatorUdid: string, useCache?: boolean): Promise<void>;
/**
 * Build and launch React Native app on simulator
 */
export declare function launchReactNativeApp(projectPath: string, simulatorUdid: string): Promise<void>;
/**
 * Build and launch native iOS app on simulator
 */
export declare function launchNativeIosApp(projectPath: string, simulatorUdid: string, scheme?: string): Promise<void>;
/**
 * Generic launch function that detects project type and launches accordingly
 */
export declare function launchProject(projectPath: string, simulatorUdid: string, projectType?: ProjectType, options?: {
    useCache?: boolean;
    scheme?: string;
}): Promise<void>;
//# sourceMappingURL=launch.d.ts.map