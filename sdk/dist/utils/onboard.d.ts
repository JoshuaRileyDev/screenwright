/**
 * Onboarding utilities for Screenwright CLI
 *
 * Checks for required tools, installs if missing, and collects API keys
 */
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
export declare function getOnboardConfigPath(): string;
/**
 * Load onboard config
 */
export declare function loadOnboardConfig(): Promise<OnboardConfig | null>;
/**
 * Save onboard config
 */
export declare function saveOnboardConfig(config: OnboardConfig): Promise<void>;
/**
 * Check if Xcode is installed
 */
export declare function checkXcode(): Promise<ToolCheck>;
/**
 * Check if simctl is available
 */
export declare function checkSimctl(): Promise<ToolCheck>;
/**
 * Check if FFmpeg is installed
 */
export declare function checkFfmpeg(): Promise<ToolCheck>;
/**
 * Check if AXe CLI is installed
 */
export declare function checkAxe(): Promise<ToolCheck>;
/**
 * Check if Homebrew is installed
 */
export declare function checkHomebrew(): Promise<ToolCheck>;
/**
 * Run all tool checks
 */
export declare function checkAllTools(): Promise<ToolCheck[]>;
/**
 * Check if all required tools are installed
 */
export declare function hasAllRequiredTools(): Promise<boolean>;
/**
 * Prompt user for API keys
 */
export declare function promptForApiKeys(): Promise<{
    openrouter?: string;
    elevenlabs?: string;
}>;
/**
 * Validate an API key format
 */
export declare function validateApiKey(key: string, service: 'openrouter' | 'elevenlabs'): boolean;
/**
 * Get environment variable from config
 */
export declare function loadApiKeyToEnv(service: 'openrouter' | 'elevenlabs'): Promise<boolean>;
/**
 * Load all API keys to environment
 */
export declare function loadAllApiKeysToEnv(): Promise<void>;
//# sourceMappingURL=onboard.d.ts.map