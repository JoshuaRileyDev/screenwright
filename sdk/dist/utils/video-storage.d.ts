/**
 * Video storage utilities for managing videos in .instructions folder
 */
import type { Video, VideoStorage, ContentIdea } from '../types-video.js';
/**
 * Get the video storage file path
 */
export declare function getVideoStoragePath(projectPath: string): string;
/**
 * Load video storage from project
 */
export declare function loadVideoStorage(projectPath: string): Promise<VideoStorage | null>;
/**
 * Save video storage to project
 */
export declare function saveVideoStorage(projectPath: string, storage: VideoStorage): Promise<void>;
/**
 * Initialize video storage for a project
 */
export declare function initializeVideoStorage(projectPath: string): Promise<VideoStorage>;
/**
 * Get or create video storage
 */
export declare function getOrCreateVideoStorage(projectPath: string): Promise<VideoStorage>;
/**
 * List all videos
 */
export declare function listVideos(projectPath: string): Promise<Video[]>;
/**
 * Get a video by ID
 */
export declare function getVideo(projectPath: string, videoId: string): Promise<Video | null>;
/**
 * Create a new video from a content idea
 */
export declare function createVideo(projectPath: string, idea: ContentIdea): Promise<Video>;
/**
 * Update video stage
 */
export declare function updateVideoStage(projectPath: string, videoId: string, stage: keyof Video['stages'], data?: any): Promise<Video | null>;
/**
 * Set video as failed
 */
export declare function setVideoFailed(projectPath: string, videoId: string, error: string): Promise<Video | null>;
/**
 * Delete a video
 */
export declare function deleteVideo(projectPath: string, videoId: string): Promise<boolean>;
/**
 * Add content ideas
 */
export declare function addContentIdeas(projectPath: string, ideas: ContentIdea[]): Promise<void>;
/**
 * Get content ideas
 */
export declare function getContentIdeas(projectPath: string): Promise<ContentIdea[]>;
/**
 * Get video directory for a video
 */
export declare function getVideoDir(projectPath: string, videoId: string): string;
/**
 * Create video directory
 */
export declare function createVideoDir(projectPath: string, videoId: string): Promise<string>;
//# sourceMappingURL=video-storage.d.ts.map