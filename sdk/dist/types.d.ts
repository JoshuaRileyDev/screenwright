/**
 * Shared types for Dev Launcher CLI
 */
export type ProjectType = 'expo' | 'react-native' | 'unknown' | 'native-ios';
export interface SimulatorInfo {
    udid: string;
    name: string;
    deviceType: string;
    runtime: string;
    state: string;
}
export interface AppConfig {
    scheme: string | null;
    bundleId: string | null;
}
export interface LaunchOptions {
    device?: string;
    useCache?: boolean;
    clean?: boolean;
}
export interface InitOptions {
    force?: boolean;
}
export interface InstructionsConfig {
    version: string;
    projectPath: string;
    projectType: ProjectType;
    createdAt: string;
    lastUpdated: string;
    preferences: {
        defaultDevice?: string;
        defaultUseCache?: boolean;
        defaultClean?: boolean;
    };
}
export interface ListSimulatorsOptions {
    booted?: boolean;
    available?: boolean;
    json?: boolean;
}
//# sourceMappingURL=types.d.ts.map