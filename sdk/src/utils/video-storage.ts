/**
 * Video storage utilities for managing videos in .instructions folder
 */

import type { Video, VideoStorage, ContentIdea, RecordingPlan, VoiceoverScript, VideoStage } from '../types-video.js';
import { getInstructionsDir } from './config.js';

const VIDEO_STORAGE_FILE = 'videos.json';

/**
 * Get the video storage file path
 */
export function getVideoStoragePath(projectPath: string): string {
  return `${getInstructionsDir(projectPath)}/${VIDEO_STORAGE_FILE}`;
}

/**
 * Load video storage from project
 */
export async function loadVideoStorage(projectPath: string): Promise<VideoStorage | null> {
  const storagePath = getVideoStoragePath(projectPath);
  const storageFile = Bun.file(storagePath);

  if (!await storageFile.exists()) {
    return null;
  }

  try {
    return await storageFile.json() as VideoStorage;
  } catch {
    return null;
  }
}

/**
 * Save video storage to project
 */
export async function saveVideoStorage(projectPath: string, storage: VideoStorage): Promise<void> {
  const storagePath = getVideoStoragePath(projectPath);
  await Bun.write(storagePath, JSON.stringify(storage, null, 2));
}

/**
 * Initialize video storage for a project
 */
export async function initializeVideoStorage(projectPath: string): Promise<VideoStorage> {
  const storage: VideoStorage = {
    version: '1.0.0',
    projectPath,
    videos: [],
    contentIdeas: [],
  };
  await saveVideoStorage(projectPath, storage);
  return storage;
}

/**
 * Get or create video storage
 */
export async function getOrCreateVideoStorage(projectPath: string): Promise<VideoStorage> {
  let storage = await loadVideoStorage(projectPath);
  if (!storage) {
    storage = await initializeVideoStorage(projectPath);
  }
  return storage;
}

/**
 * List all videos
 */
export async function listVideos(projectPath: string): Promise<Video[]> {
  const storage = await loadVideoStorage(projectPath);
  return storage?.videos || [];
}

/**
 * Get a video by ID
 */
export async function getVideo(projectPath: string, videoId: string): Promise<Video | null> {
  const videos = await listVideos(projectPath);
  return videos.find(v => v.id === videoId) || null;
}

/**
 * Create a new video from a content idea
 */
export async function createVideo(
  projectPath: string,
  idea: ContentIdea
): Promise<Video> {
  const storage = await getOrCreateVideoStorage(projectPath);

  const now = new Date().toISOString();
  const video: Video = {
    id: `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    title: idea.title,
    description: idea.description,
    feature: idea.feature,
    category: idea.category,
    createdAt: now,
    updatedAt: now,
    currentStage: 'idea',
    stages: {
      idea: { completed: true, at: now },
      plan: { completed: false },
      script: { completed: false },
      record: { completed: false },
      composite: { completed: false },
    },
  };

  storage.videos.push(video);
  await saveVideoStorage(projectPath, storage);

  return video;
}

/**
 * Update video stage
 */
export async function updateVideoStage(
  projectPath: string,
  videoId: string,
  stage: keyof Video['stages'],
  data?: any
): Promise<Video | null> {
  const storage = await getOrCreateVideoStorage(projectPath);
  const video = storage.videos.find(v => v.id === videoId);

  if (!video) {
    return null;
  }

  const now = new Date().toISOString();
  (video.stages[stage] as any).completed = true;
  (video.stages[stage] as any).at = now;

  // Only set data if the stage supports it
  if (data && stage === 'plan') {
    (video.stages[stage] as any).data = data;
  } else if (data && stage === 'script') {
    (video.stages[stage] as any).data = data;
  }

  video.updatedAt = now;
  video.currentStage = stage as VideoStage;

  await saveVideoStorage(projectPath, storage);
  return video;
}

/**
 * Set video as failed
 */
export async function setVideoFailed(
  projectPath: string,
  videoId: string,
  error: string
): Promise<Video | null> {
  const storage = await getOrCreateVideoStorage(projectPath);
  const video = storage.videos.find(v => v.id === videoId);

  if (!video) {
    return null;
  }

  video.currentStage = 'failed';
  video.error = error;
  video.updatedAt = new Date().toISOString();

  await saveVideoStorage(projectPath, storage);
  return video;
}

/**
 * Delete a video
 */
export async function deleteVideo(projectPath: string, videoId: string): Promise<boolean> {
  const storage = await getOrCreateVideoStorage(projectPath);
  const index = storage.videos.findIndex(v => v.id === videoId);

  if (index === -1) {
    return false;
  }

  storage.videos.splice(index, 1);
  await saveVideoStorage(projectPath, storage);
  return true;
}

/**
 * Add content ideas
 */
export async function addContentIdeas(
  projectPath: string,
  ideas: ContentIdea[]
): Promise<void> {
  const storage = await getOrCreateVideoStorage(projectPath);

  // Add only new ideas (by title)
  const existingTitles = new Set(storage.contentIdeas.map(i => i.title));
  const newIdeas = ideas.filter(i => !existingTitles.has(i.title));

  storage.contentIdeas.push(...newIdeas);
  await saveVideoStorage(projectPath, storage);
}

/**
 * Get content ideas
 */
export async function getContentIdeas(projectPath: string): Promise<ContentIdea[]> {
  const storage = await loadVideoStorage(projectPath);
  return storage?.contentIdeas || [];
}

/**
 * Get video directory for a video
 */
export function getVideoDir(projectPath: string, videoId: string): string {
  return `${getInstructionsDir(projectPath)}/videos/${videoId}`;
}

/**
 * Create video directory
 */
export async function createVideoDir(projectPath: string, videoId: string): Promise<string> {
  const dir = getVideoDir(projectPath, videoId);

  const mkdirProc = Bun.spawn(['mkdir', '-p', dir], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await mkdirProc.exited;

  if (mkdirProc.exitCode !== 0) {
    throw new Error('Failed to create video directory');
  }

  return dir;
}
