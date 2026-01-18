/**
 * iOS Simulator management utilities
 */
import type { SimulatorInfo } from '../types.js';
/**
 * List all available iOS simulators
 */
export declare function listSimulators(): Promise<SimulatorInfo[]>;
/**
 * Get booted simulators
 */
export declare function getBootedSimulators(): Promise<SimulatorInfo[]>;
/**
 * Get available (shutdown) simulators
 */
export declare function getAvailableSimulators(): Promise<SimulatorInfo[]>;
/**
 * Boot a simulator
 */
export declare function bootSimulator(udid: string): Promise<void>;
/**
 * Shutdown a simulator
 */
export declare function shutdownSimulator(udid: string): Promise<void>;
/**
 * Create a new simulator
 */
export declare function createSimulator(name: string, deviceType: string, runtime: string): Promise<string>;
/**
 * Delete a simulator
 */
export declare function deleteSimulator(udid: string): Promise<void>;
/**
 * Get available device types
 */
export declare function listAvailableDeviceTypes(): Promise<string[]>;
/**
 * Get available runtimes
 */
export declare function listAvailableRuntimes(): Promise<string[]>;
/**
 * Find a simulator by device model (e.g., "iPhone 15 Pro")
 */
export declare function findSimulatorByDeviceModel(deviceModel: string): Promise<SimulatorInfo | null>;
/**
 * Find or create a simulator for a given device model
 */
export declare function findOrCreateSimulator(deviceModel?: string): Promise<SimulatorInfo>;
/**
 * Wait for simulator to be ready
 */
export declare function waitForSimulatorReady(udid: string, timeoutMs?: number): Promise<void>;
/**
 * Open Xcode Simulator app
 */
export declare function openSimulatorApp(): Promise<void>;
/**
 * Open Xcode
 */
export declare function openXcode(projectPath?: string): Promise<void>;
//# sourceMappingURL=simulator.d.ts.map