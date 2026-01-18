/**
 * Video creation types for Screenwright SDK
 */

export interface GenerateContentOptions {
  maxIdeas?: number;
  maxCategories?: number;
  existingContent?: Array<{ title: string; description?: string; category?: string }>;
}

export interface ContentIdea {
  id: string;
  title: string;
  description: string;
  feature: string;
  setupSteps: string[];
  recordingSteps: string[];
  category?: string;
  createdAt: string;
}

export interface ContentCategory {
  name: string;
  description: string;
  content: ContentIdea[];
}

export interface ActionStep {
  type: 'tap' | 'swipe' | 'type' | 'wait' | 'press_button' | 'verify';
  description: string;
  target?: { x: number; y: number };
  input?: string;
  direction?: 'up' | 'down' | 'left' | 'right';
  button?: 'home' | 'back';
  waitMs?: number;
  verification?: string;
}

export interface RecordingPlan {
  title: string;
  description: string;
  setupSteps: ActionStep[];
  recordingSteps: ActionStep[];
  estimatedDurationSeconds: number;
  screenshots?: string[];
}

export interface TimestampedAction {
  action: ActionStep;
  startTime: number;
  endTime: number;
}

export interface VoiceoverScript {
  script: string;
  totalDuration: number;
  timestampedActions: TimestampedAction[];
}

export type VideoStage = 'idea' | 'planned' | 'scripted' | 'recorded' | 'composite' | 'failed';

export interface Video {
  id: string;
  title: string;
  description: string;
  feature: string;
  category?: string;
  createdAt: string;
  updatedAt: string;
  currentStage: VideoStage;
  stages: {
    idea: { completed: boolean; at?: string };
    plan: { completed: boolean; at?: string; data?: RecordingPlan };
    script: { completed: boolean; at?: string; data?: VoiceoverScript };
    record: { completed: boolean; at?: string; videoPath?: string; duration?: number };
    composite: { completed: boolean; at?: string; videoPath?: string };
  };
  simulatorUdid?: string;
  error?: string;
}

export interface VideoStorage {
  version: string;
  projectPath: string;
  videos: Video[];
  contentIdeas: ContentIdea[];
}
