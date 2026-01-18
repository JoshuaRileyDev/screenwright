/**
 * Tests for video-storage.ts - Video storage utilities
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import * as videoStorage from '../../src/utils/video-storage.js';
import { createTempDir, cleanupTempDir } from '../setup.js';
import type { Video, ContentIdea, VideoStorage } from '../../src/types-video.js';

describe('Video Storage', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await createTempDir('video-storage');
  });

  afterEach(async () => {
    await cleanupTempDir(tempDir);
  });

  describe('loadStorage', () => {
    it('should create new storage if it does not exist', async () => {
      const storage = await videoStorage.loadStorage(tempDir);

      expect(storage.version).toBe('1.0.0');
      expect(storage.projectPath).toBe(tempDir);
      expect(storage.videos).toEqual([]);
      expect(storage.contentIdeas).toEqual([]);
    });

    it('should load existing storage', async () => {
      // Create initial storage
      await videoStorage.loadStorage(tempDir);

      // Load again
      const storage = await videoStorage.loadStorage(tempDir);
      expect(storage.projectPath).toBe(tempDir);
    });
  });

  describe('saveStorage', () => {
    it('should save storage to file', async () => {
      const storage: VideoStorage = {
        version: '1.0.0',
        projectPath: tempDir,
        videos: [],
        contentIdeas: [],
      };

      await videoStorage.saveStorage(tempDir, storage);

      // Verify file exists
      const storagePath = videoStorage.getStoragePath(tempDir);
      expect(await Bun.file(storagePath).exists()).toBe(true);

      // Verify content
      const loaded = await videoStorage.loadStorage(tempDir);
      expect(loaded).toEqual(storage);
    });
  });

  describe('addVideo', () => {
    it('should add video to storage', async () => {
      const video: Video = {
        id: 'test-video-1',
        title: 'Test Video',
        description: 'Test Description',
        feature: 'test-feature',
        category: 'Getting Started',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStage: 'idea',
        stages: {
          idea: { completed: true },
          plan: { completed: false },
          script: { completed: false },
          record: { completed: false },
          composite: { completed: false },
        },
      };

      const result = await videoStorage.addVideo(tempDir, video);

      expect(result).toEqual(video);

      // Verify it was saved
      const storage = await videoStorage.loadStorage(tempDir);
      expect(storage.videos).toHaveLength(1);
      expect(storage.videos[0]).toEqual(video);
    });
  });

  describe('getVideo', () => {
    it('should retrieve video by id', async () => {
      const video: Video = {
        id: 'test-video-2',
        title: 'Test Video 2',
        description: 'Test Description 2',
        feature: 'test-feature-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStage: 'idea',
        stages: {
          idea: { completed: true },
          plan: { completed: false },
          script: { completed: false },
          record: { completed: false },
          composite: { completed: false },
        },
      };

      await videoStorage.addVideo(tempDir, video);
      const result = await videoStorage.getVideo(tempDir, video.id);

      expect(result).toEqual(video);
    });

    it('should return null for non-existent video', async () => {
      const result = await videoStorage.getVideo(tempDir, 'non-existent');
      expect(result).toBeNull();
    });
  });

  describe('listVideos', () => {
    it('should return empty array when no videos exist', async () => {
      const result = await videoStorage.listVideos(tempDir);
      expect(result).toEqual([]);
    });

    it('should return all videos', async () => {
      const video1: Video = {
        id: 'video-1',
        title: 'Video 1',
        description: 'Description 1',
        feature: 'feature-1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStage: 'idea',
        stages: {
          idea: { completed: true },
          plan: { completed: false },
          script: { completed: false },
          record: { completed: false },
          composite: { completed: false },
        },
      };

      const video2: Video = {
        id: 'video-2',
        title: 'Video 2',
        description: 'Description 2',
        feature: 'feature-2',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStage: 'planned',
        stages: {
          idea: { completed: true },
          plan: { completed: true },
          script: { completed: false },
          record: { completed: false },
          composite: { completed: false },
        },
      };

      await videoStorage.addVideo(tempDir, video1);
      await videoStorage.addVideo(tempDir, video2);

      const result = await videoStorage.listVideos(tempDir);
      expect(result).toHaveLength(2);
    });
  });

  describe('updateVideo', () => {
    it('should update video', async () => {
      const video: Video = {
        id: 'video-update',
        title: 'Original Title',
        description: 'Original Description',
        feature: 'feature',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStage: 'idea',
        stages: {
          idea: { completed: true },
          plan: { completed: false },
          script: { completed: false },
          record: { completed: false },
          composite: { completed: false },
        },
      };

      await videoStorage.addVideo(tempDir, video);

      // Update the video
      const updates = {
        title: 'Updated Title',
        currentStage: 'planned' as const,
      };

      const result = await videoStorage.updateVideo(tempDir, video.id, updates);

      expect(result?.title).toBe('Updated Title');
      expect(result?.currentStage).toBe('planned');
    });

    it('should return null for non-existent video', async () => {
      const result = await videoStorage.updateVideo(tempDir, 'non-existent', {});
      expect(result).toBeNull();
    });
  });

  describe('deleteVideo', () => {
    it('should delete video', async () => {
      const video: Video = {
        id: 'video-delete',
        title: 'Video to Delete',
        description: 'Description',
        feature: 'feature',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        currentStage: 'idea',
        stages: {
          idea: { completed: true },
          plan: { completed: false },
          script: { completed: false },
          record: { completed: false },
          composite: { completed: false },
        },
      };

      await videoStorage.addVideo(tempDir, video);

      // Delete the video
      const result = await videoStorage.deleteVideo(tempDir, video.id);

      expect(result).toBe(true);

      // Verify it's gone
      const storage = await videoStorage.loadStorage(tempDir);
      expect(storage.videos).toHaveLength(0);
    });

    it('should return false for non-existent video', async () => {
      const result = await videoStorage.deleteVideo(tempDir, 'non-existent');
      expect(result).toBe(false);
    });
  });

  describe('addContentIdeas', () => {
    it('should add content ideas to storage', async () => {
      const ideas: ContentIdea[] = [
        {
          id: 'idea-1',
          title: 'Idea 1',
          description: 'Description 1',
          feature: 'feature-1',
          setupSteps: [],
          recordingSteps: [],
          category: 'Getting Started',
          createdAt: new Date().toISOString(),
        },
        {
          id: 'idea-2',
          title: 'Idea 2',
          description: 'Description 2',
          feature: 'feature-2',
          setupSteps: [],
          recordingSteps: [],
          category: 'Getting Started',
          createdAt: new Date().toISOString(),
        },
      ];

      await videoStorage.addContentIdeas(tempDir, ideas);

      const storage = await videoStorage.loadStorage(tempDir);
      expect(storage.contentIdeas).toHaveLength(2);
      expect(storage.contentIdeas[0].title).toBe('Idea 1');
    });
  });

  describe('getContentIdeas', () => {
    it('should return all content ideas', async () => {
      const ideas: ContentIdea[] = [
        {
          id: 'idea-get-1',
          title: 'Get Idea 1',
          description: 'Description',
          feature: 'feature',
          setupSteps: [],
          recordingSteps: [],
          createdAt: new Date().toISOString(),
        },
      ];

      await videoStorage.addContentIdeas(tempDir, ideas);

      const result = await videoStorage.getContentIdeas(tempDir);
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Get Idea 1');
    });

    it('should return empty array when no ideas exist', async () => {
      const result = await videoStorage.getContentIdeas(tempDir);
      expect(result).toEqual([]);
    });
  });

  describe('createVideo from idea', () => {
    it('should create video from content idea', async () => {
      const idea: ContentIdea = {
        id: 'idea-create',
        title: 'Idea for Video',
        description: 'Video Description',
        feature: 'feature',
        setupSteps: ['Step 1'],
        recordingSteps: ['Step 2'],
        category: 'Getting Started',
        createdAt: new Date().toISOString(),
      };

      const video = await videoStorage.createVideo(tempDir, idea);

      expect(video.title).toBe('Idea for Video');
      expect(video.description).toBe('Video Description');
      expect(video.feature).toBe('feature');
      expect(video.currentStage).toBe('idea');
      expect(video.stages.idea.completed).toBe(true);
      expect(video.stages.idea.at).toBeDefined();

      // Verify it was saved
      const storage = await videoStorage.loadStorage(tempDir);
      expect(storage.videos).toHaveLength(1);
    });
  });

  describe('updateVideoStage', () => {
    it('should update video stage with data', async () => {
      const idea: ContentIdea = {
        id: 'idea-stage',
        title: 'Stage Test',
        description: 'Description',
        feature: 'feature',
        setupSteps: [],
        recordingSteps: [],
        createdAt: new Date().toISOString(),
      };

      const video = await videoStorage.createVideo(tempDir, idea);

      const planData = {
        title: 'Test Plan',
        description: 'Test Description',
        setupSteps: [],
        recordingSteps: [],
        estimatedDurationSeconds: 60,
        screenshots: [],
      };

      const updated = await videoStorage.updateVideoStage(
        tempDir,
        video.id,
        'plan',
        planData
      );

      expect(updated?.currentStage).toBe('planned');
      expect(updated?.stages.plan.completed).toBe(true);
      expect(updated?.stages.plan.data).toEqual(planData);
    });
  });
});
