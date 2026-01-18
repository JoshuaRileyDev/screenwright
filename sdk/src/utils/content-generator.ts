/**
 * Content generation utilities - Generate video ideas from project
 */

import type { ContentCategory, ContentIdea, GenerateContentOptions } from '../types-video.js';
import { detectProjectType } from './detect.js';
import { addContentIdeas } from './video-storage.js';

/**
 * Generate content ideas based on project analysis
 */
export async function generateContentIdeas(
  projectPath: string,
  options: GenerateContentOptions = {}
): Promise<ContentCategory[]> {
  console.log('[Content] Analyzing project for content ideas...');

  const projectType = await detectProjectType(projectPath);
  const maxIdeas = options.maxIdeas || 10;
  const maxCategories = options.maxCategories || 3;

  // Read package.json for more context
  let packageName = 'app';
  let packageDescription = '';

  try {
    const packageJsonPath = `${projectPath}/package.json`;
    const packageJson = await Bun.file(packageJsonPath).json();
    packageName = packageJson.name || 'app';
    packageDescription = packageJson.description || '';
  } catch {
    // Continue without package info
  }

  // Check for app.json for Expo apps
  let appName = packageName;
  try {
    const appJsonPath = `${projectPath}/app.json`;
    const appJson = await Bun.file(appJsonPath).json();
    appName = appJson.name || appJson.expo?.name || appName;
  } catch {
    // Continue without app name
  }

  console.log(`[Content] Project: ${appName} (${projectType})`);

  // Analyze project structure
  const analysis = await analyzeProjectStructure(projectPath, projectType);
  console.log(`[Content] Found ${analysis.features.length} features, ${analysis.screens.length} screens`);

  // Generate categories based on project type and analysis
  const categories = generateCategoriesForProject(
    appName,
    projectType,
    analysis,
    maxIdeas,
    maxCategories
  );

  console.log(`[Content] Generated ${categories.length} categories with ${categories.reduce((sum, c) => sum + c.content.length, 0)} ideas`);

  return categories;
}

/**
 * Analyze project structure to identify features and screens
 */
async function analyzeProjectStructure(
  projectPath: string,
  projectType: string
): Promise<{ features: string[]; screens: string[] }> {
  const features: string[] = [];
  const screens: string[] = [];

  // Common patterns to look for
  const patterns = {
    features: [
      'auth', 'login', 'signup', 'profile', 'settings', 'notification',
      'chat', 'message', 'post', 'feed', 'search', 'filter',
      'camera', 'photo', 'video', 'upload', 'download',
      'map', 'location', 'navigation', 'route',
      'payment', 'checkout', 'cart', 'order',
      'social', 'friend', 'follow', 'like', 'comment',
      'dashboard', 'analytics', 'report', 'chart',
      'todo', 'task', 'reminder', 'calendar', 'event'
    ],
    screens: [
      'home', 'main', 'landing', 'splash', 'welcome',
      'detail', 'list', 'grid', 'form',
      'modal', 'drawer', 'tab', 'stack'
    ]
  };

  // Search for these patterns in the codebase
  try {
    // Use find to get source files
    const findProc = Bun.spawn([
      'find',
      projectPath,
      '-type', 'f',
      '-name', '*.tsx',
      '-o', '-name', '*.ts',
      '-o', '-name', '*.jsx',
      '-o', '-name', '*.js',
      '-o', '-name', '*.swift',
      '-o', '-name', '*.m'
    ], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await findProc.exited;

    if (findProc.exitCode === 0) {
      const files = await new Response(findProc.stdout).text();
      const fileList = files.trim().split('\n').filter(f => f && !f.includes('node_modules'));

      // Analyze a sample of files
      const sampleSize = Math.min(fileList.length, 20);
      const sample = fileList.slice(0, sampleSize);

      for (const file of sample) {
        try {
          const content = await Bun.file(file).text();
          const lowerContent = content.toLowerCase();

          // Check for feature patterns
          for (const feature of patterns.features) {
            if (lowerContent.includes(feature) && !features.includes(feature)) {
              features.push(feature);
            }
          }

          // Check for screen patterns
          for (const screen of patterns.screens) {
            if (lowerContent.includes(screen) && !screens.includes(screen)) {
              screens.push(screen);
            }
          }
        } catch {
          // Skip files that can't be read
        }
      }
    }
  } catch {
    // Continue with empty analysis
  }

  return { features, screens };
}

/**
 * Generate content categories based on project analysis
 */
function generateCategoriesForProject(
  appName: string,
  projectType: string,
  analysis: { features: string[]; screens: string[] },
  maxIdeas: number,
  maxCategories: number
): ContentCategory[] {
  const categories: ContentCategory[] = [];

  // Category 1: Getting Started (always included)
  const gettingStarted: ContentCategory = {
    name: 'Getting Started',
    description: `Learn the basics of using ${appName}`,
    content: [
      {
        id: `idea_${Date.now()}_1`,
        title: `Getting Started with ${appName}`,
        description: `A quick introduction to ${appName} and its main features. Learn how to navigate the app and understand its core functionality.`,
        feature: 'onboarding',
        setupSteps: [],
        recordingSteps: [
          `Open ${appName} to see the home screen`,
          `Notice the main navigation elements at the bottom`,
          `Tap through different sections to explore`,
          `Observe the clean layout and intuitive design`
        ],
        category: 'Getting Started',
        createdAt: new Date().toISOString()
      }
    ]
  };

  // Add first-time setup if auth features exist
  if (analysis.features.includes('auth') || analysis.features.includes('login')) {
    gettingStarted.content.push({
      id: `idea_${Date.now()}_2`,
      title: 'Creating Your Account',
      description: 'Learn how to sign up for a new account and complete your profile setup.',
      feature: 'authentication',
      setupSteps: [],
      recordingSteps: [
        'Tap the "Sign Up" or "Get Started" button',
        'Enter your email address and create a password',
        'Fill in your profile information',
        'Verify your email if required',
        'See your personalized dashboard'
      ],
      category: 'Getting Started',
      createdAt: new Date().toISOString()
    });
  }

  categories.push(gettingStarted);

  // Category 2: Core Features based on detected features
  if (analysis.features.length > 0) {
    const coreFeatures: ContentCategory = {
      name: 'Core Features',
      description: `Learn how to use ${appName}'s main features`,
      content: []
    };

    // Generate ideas for top features
    const topFeatures = analysis.features.slice(0, 4);
    let ideaCount = gettingStarted.content.length;

    for (const feature of topFeatures) {
      if (ideaCount >= maxIdeas) break;

      const featureName = feature.charAt(0).toUpperCase() + feature.slice(1);
      const idea = createFeatureIdea(feature, appName, ideaCount);
      if (idea) {
        coreFeatures.content.push(idea);
        ideaCount++;
      }
    }

    if (coreFeatures.content.length > 0) {
      categories.push(coreFeatures);
    }
  }

  // Category 3: Settings & Customization (if settings exist)
  if (analysis.features.includes('settings') || analysis.features.includes('profile')) {
    const settings: ContentCategory = {
      name: 'Settings & Customization',
      description: 'Customize your experience and manage your preferences',
      content: []
    };

    if (analysis.features.includes('profile')) {
      settings.content.push({
        id: `idea_${Date.now()}_${categories.length + 1}`,
        title: 'Managing Your Profile',
        description: 'Learn how to update your profile information, change your avatar, and manage your account settings.',
        feature: 'profile',
        setupSteps: [
          'Open the app and tap on your profile icon',
          'Select "Edit Profile" from the menu'
        ],
        recordingSteps: [
          'Update your display name',
          'Change your profile picture',
          'Add a bio or description',
          'Save your changes',
          'Verify the updates are reflected'
        ],
        category: 'Settings & Customization',
        createdAt: new Date().toISOString()
      });
    }

    if (analysis.features.includes('settings')) {
      settings.content.push({
        id: `idea_${Date.now()}_${categories.length + 2}`,
        title: 'Configuring App Settings',
        description: 'Learn how to customize app notifications, privacy settings, and other preferences.',
        feature: 'settings',
        setupSteps: [
          'Tap the Settings icon in the navigation',
          'Browse through available settings'
        ],
        recordingSteps: [
          'Toggle notifications on or off',
          'Adjust notification preferences',
          'Configure privacy settings',
          'Test theme options if available',
          'Save your preferences'
        ],
        category: 'Settings & Customization',
        createdAt: new Date().toISOString()
      });
    }

    if (settings.content.length > 0) {
      categories.push(settings);
    }
  }

  return categories.slice(0, maxCategories);
}

/**
 * Create a content idea for a feature
 */
function createFeatureIdea(
  feature: string,
  appName: string,
  index: number
): ContentIdea | null {
  const featureName = feature.charAt(0).toUpperCase() + feature.slice(1);

  const featureTemplates: Record<string, Partial<ContentIdea>> = {
    post: {
      title: 'Creating a Post',
      description: `Learn how to create and share posts on ${appName}.`,
      recordingSteps: [
        'Tap the create or post button (usually + icon)',
        'Add text content',
        'Attach photos or media if desired',
        'Add tags or location if available',
        'Tap "Post" or "Share" to publish',
        'See your post in the feed'
      ]
    },
    search: {
      title: 'Searching for Content',
      description: `Learn how to search and find content on ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        'Tap the search icon or bar',
        'Type a search term',
        'See suggested results as you type',
        'Tap on a result to view',
        'Use filters if available'
      ]
    },
    chat: {
      title: 'Sending Messages',
      description: `Learn how to send messages and chat on ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        'Tap on a conversation or the new message icon',
        'Type your message in the text field',
        'Tap send to deliver the message',
        'See the message appear in the conversation'
      ]
    },
    notification: {
      title: 'Managing Notifications',
      description: `Learn how to view and manage your notifications on ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        'Tap the notifications bell icon',
        'View your recent notifications',
        'Tap on a notification to open it',
        'Swipe left on a notification to dismiss',
        'Tap "Mark all as read" if available'
      ]
    },
    camera: {
      title: 'Taking Photos',
      description: `Learn how to take and share photos using ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        'Tap the camera icon',
        'Grant camera permissions if asked',
        'Frame your shot in the viewfinder',
        'Tap the shutter button to capture',
        'Review your photo',
        'Add effects or filters if available',
        'Share or save the photo'
      ]
    },
    profile: {
      title: 'Viewing Profiles',
      description: `Learn how to view user profiles on ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        'Search for a user or tap on a username',
        'View their profile information',
        'See their posts or activity',
        'Follow or connect if available'
      ]
    },
    map: {
      title: 'Using the Map',
      description: `Learn how to use the map features in ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        'Navigate to the map section',
        'Grant location permissions if asked',
        'See your current location on the map',
        'Search for a place',
        'Get directions to a location'
      ]
    }
  };

  const template = featureTemplates[feature];
  if (!template) {
    // Generic template for unknown features
    return {
      id: `idea_${Date.now()}_${index}`,
      title: `Using ${featureName}`,
      description: `Learn how to use the ${featureName} feature in ${appName}.`,
      feature,
      setupSteps: [],
      recordingSteps: [
        `Navigate to the ${featureName} section`,
        `Explore the available options`,
        `Interact with the main features`,
        `Observe the results`
      ],
      category: 'Core Features',
      createdAt: new Date().toISOString()
    };
  }

  return {
    id: `idea_${Date.now()}_${index}`,
    title: template.title || `Using ${featureName}`,
    description: template.description || `Learn how to use the ${featureName} feature in ${appName}.`,
    feature,
    setupSteps: template.setupSteps || [],
    recordingSteps: template.recordingSteps || [],
    category: 'Core Features',
    createdAt: new Date().toISOString()
  };
}

/**
 * Generate and save content ideas for a project
 */
export async function generateAndSaveContentIdeas(
  projectPath: string,
  options: GenerateContentOptions = {}
): Promise<ContentCategory[]> {
  const categories = await generateContentIdeas(projectPath, options);

  // Flatten categories to ideas and save
  const allIdeas: ContentIdea[] = [];
  for (const category of categories) {
    for (const idea of category.content) {
      allIdeas.push(idea);
    }
  }

  await addContentIdeas(projectPath, allIdeas);

  return categories;
}
