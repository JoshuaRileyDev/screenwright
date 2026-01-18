/**
 * Planner Agent Types
 * Types for creating detailed recording plans by physically testing workflows
 */

export interface UIElement {
  type: string;
  label?: string;
  value?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  enabled: boolean;
  visible: boolean;
}

export interface ActionStep {
  type: 'tap' | 'swipe' | 'type' | 'wait' | 'press_button' | 'verify';
  description: string;
  target?: {
    element?: UIElement;
    x?: number;
    y?: number;
  };
  input?: string; // For type actions
  direction?: 'up' | 'down' | 'left' | 'right'; // For swipe actions
  button?: 'home' | 'back'; // For press_button actions
  waitMs?: number; // For wait actions
  verification?: string; // For verify actions
}

export interface RecordingPlan {
  title: string;
  description: string;
  setupSteps: ActionStep[];
  recordingSteps: ActionStep[];
  estimatedDurationSeconds: number;
  screenshots: string[]; // Base64 encoded screenshots at key points
}

export interface PlannerInput {
  simulatorUdid: string;
  videoIdea: {
    title: string;
    description: string;
    feature: string;
    setupSteps: string[];
    recordingSteps: string[];
  };
}

/**
 * Mobile automation tool interface
 * Implement this to interact with iOS simulators
 */
export interface MobileAutomation {
  takeScreenshot(udid: string): Promise<{ screenshot: string; format: string; width: number; height: number }>;
  listElements(udid: string): Promise<{ elements: UIElement[] }>;
  tapAt(udid: string, x: number, y: number): Promise<{ success: boolean }>;
  swipe(udid: string, direction: 'up' | 'down' | 'left' | 'right'): Promise<{ success: boolean }>;
  typeText(udid: string, text: string, submit?: boolean): Promise<{ success: boolean }>;
  terminateAllApps(udid: string): Promise<void>;
  pressButton(udid: string, button: 'home' | 'back'): Promise<void>;
}
