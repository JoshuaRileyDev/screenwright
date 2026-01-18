#!/usr/bin/env bun
/**
 * Screenwright CLI - Main Entry Point
 *
 * An intuitive CLI tool for iOS development - launch apps, manage simulators,
 * and create tutorial videos with AI-powered automation.
 */

import { Command } from 'commander';
import chalk from 'chalk';
import ora, { Ora } from 'ora';
import prompts from 'prompts';

import * as detectUtils from '../../sdk/dist/index.js';
import * as simulatorUtils from '../../sdk/dist/index.js';
import * as launchUtils from '../../sdk/dist/index.js';
import * as configUtils from '../../sdk/dist/index.js';
import * as videoStorage from '../../sdk/dist/index.js';
import * as contentGenerator from '../../sdk/dist/index.js';
import * as onboardUtils from '../../sdk/dist/index.js';
import type { ProjectType, SimulatorInfo } from '../../sdk/dist/index.js';
import type { Video, VideoStage, ContentIdea } from '../../sdk/dist/index.js';

const program = new Command();

// CLI Configuration
program
  .name('screenwright')
  .description('An intuitive CLI tool for iOS development - launch apps, manage simulators, and create tutorial videos')
  .version('1.0.0');

// Get current working directory
const getCwd = () => process.cwd();

/**
 * Interactively select a video from the project
 */
async function selectVideo(projectPath: string): Promise<Video | null> {
  const videos = await videoStorage.listVideos(projectPath);

  if (videos.length === 0) {
    console.log(chalk.yellow('\nNo videos found.'));
    console.log(chalk.dim('Run "screenwright content generate" to generate content ideas first.\n'));
    return null;
  }

  if (videos.length === 1) {
    return videos[0];
  }

  // Format video choices for prompts
  const choices = videos.map(video => ({
    title: `${video.title} ${chalk.dim(`(${video.id.substring(0, 8)}...)`)}`,
    description: `${formatVideoStage(video.currentStage)} - ${new Date(video.createdAt).toLocaleDateString()}`,
    value: video.id,
  }));

  const response = await prompts({
    type: 'select',
    name: 'videoId',
    message: chalk.bold('Select a video:'),
    choices,
    hint: 'Use arrow keys to navigate, Enter to select'
  });

  return videos.find(v => v.id === response) || null;
}

// Format simulator info for display
function formatSimulator(sim: SimulatorInfo): string {
  const statusColor = sim.state === 'Booted' ? chalk.green : chalk.gray;
  return `${chalk.cyan(sim.name)} ${chalk.gray(`(${sim.udid.substring(0, 8)}...)`)} ${statusColor(sim.state)}`;
}

// Format project type for display
function formatProjectType(type: ProjectType): string {
  switch (type) {
    case 'expo':
      return chalk.magenta('Expo');
    case 'react-native':
      return chalk.blue('React Native');
    case 'native-ios':
      return chalk.green('Native iOS');
    case 'unknown':
      return chalk.gray('Unknown');
  }
}

// Format video stage for display
function formatVideoStage(stage: VideoStage): string {
  switch (stage) {
    case 'idea':
      return chalk.yellow('Idea');
    case 'planned':
      return chalk.blue('Planned');
    case 'scripted':
      return chalk.cyan('Scripted');
    case 'recorded':
      return chalk.magenta('Recorded');
    case 'composite':
      return chalk.green('Complete');
    case 'failed':
      return chalk.red('Failed');
  }
}

// ============================================================================
// ONBOARD COMMAND
// ============================================================================
program
  .command('onboard')
  .description('Set up Screenwright - check tools, install dependencies, and configure API keys')
  .option('-s, --skip-tools', 'Skip tool checking and only configure API keys')
  .option('-k, --skip-keys', 'Skip API key configuration')
  .option('-f, --force', 'Re-run onboarding even if already completed')
  .action(async (options) => {
    const spinner = ora('Starting onboarding...').start();

    try {
      // Check if already onboarded
      const existingConfig = await onboardUtils.loadOnboardConfig();
      if (existingConfig && !options.force) {
        spinner.stop();
        console.log(chalk.yellow('\nYou have already completed onboarding!'));
        console.log(chalk.dim('Run with --force to re-run onboarding\n'));

        const hasOpenRouter = !!existingConfig.openrouterApiKey;
        const hasElevenLabs = !!existingConfig.elevenlabsApiKey;

        console.log(chalk.bold('Current Configuration:'));
        console.log(`  OpenRouter API Key: ${hasOpenRouter ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
        console.log(`  ElevenLabs API Key: ${hasElevenLabs ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
        console.log(`  Onboarded: ${new Date(existingConfig.onboardedAt).toLocaleString()}`);
        console.log();
        return;
      }

      // Load API keys to environment if they exist
      if (existingConfig) {
        await onboardUtils.loadAllApiKeysToEnv();
      }

      // Step 1: Check tools
      if (!options.skipTools) {
        spinner.text = 'Checking required tools...';
        const toolChecks = await onboardUtils.checkAllTools();

        spinner.stop();

        console.log('\n' + chalk.bold('Tool Check Results:\n'));

        // Separate into installed, missing required, and missing optional
        const installed = toolChecks.filter(t => t.installed);
        const missingRequired = toolChecks.filter(t => !t.installed && t.required);
        const missingOptional = toolChecks.filter(t => !t.installed && !t.required);

        // Show installed tools
        if (installed.length > 0) {
          for (const tool of installed) {
            const version = tool.version ? chalk.dim(` (${tool.version})`) : '';
            console.log(`  ${chalk.green('✓')} ${tool.name}${version}`);
          }
        }

        // Show missing required tools
        if (missingRequired.length > 0) {
          console.log('\n' + chalk.red('Missing Required Tools:'));
          for (const tool of missingRequired) {
            console.log(`  ${chalk.red('✗')} ${tool.name}`);
            if (tool.installCommand) {
              console.log(`    ${chalk.dim('Install:')} ${chalk.cyan(tool.installCommand)}`);
            }
          }
        }

        // Show missing optional tools
        if (missingOptional.length > 0) {
          console.log('\n' + chalk.yellow('Missing Optional Tools:'));
          for (const tool of missingOptional) {
            console.log(`  ${chalk.yellow('○')} ${tool.name}`);
            if (tool.installCommand) {
              console.log(`    ${chalk.dim('Install:')} ${chalk.cyan(tool.installCommand)}`);
            }
          }
        }

        // Try to install missing tools automatically
        if (missingRequired.length > 0) {
          console.log('\n' + chalk.bold('Installing Missing Tools...'));

          for (const tool of missingRequired) {
            if (tool.autoInstall) {
              const installSpinner = ora(`Installing ${tool.name}...`).start();
              try {
                const success = await tool.autoInstall();
                if (success) {
                  installSpinner.succeed(chalk.green(`${tool.name} installed`));
                } else {
                  installSpinner.fail(chalk.red(`Failed to install ${tool.name}`));
                  console.log(chalk.dim(`  Please run manually: ${tool.installCommand}`));
                }
              } catch (error) {
                installSpinner.fail(chalk.red(`Failed to install ${tool.name}`));
                console.log(chalk.dim(`  Error: ${error instanceof Error ? error.message : String(error)}`));
                console.log(chalk.dim(`  Please run manually: ${tool.installCommand}`));
              }
            }
          }

          // Re-check tools
          const recheckSpinner = ora('Rechecking tools...').start();
          const rechecked = await onboardUtils.checkAllTools();
          const stillMissing = rechecked.filter(t => !t.installed && t.required);
          recheckSpinner.stop();

          if (stillMissing.length > 0) {
            console.log('\n' + chalk.yellow('Some tools are still missing:'));
            for (const tool of stillMissing) {
              console.log(`  ${chalk.red('✗')} ${tool.name}`);
              if (tool.installCommand) {
                console.log(`    ${chalk.dim('Run:')} ${chalk.cyan(tool.installCommand)}`);
              }
            }
            console.log(chalk.yellow('\nPlease install missing tools and run onboarding again.\n'));
            process.exit(1);
          }
        }

        console.log('\n' + chalk.green('All required tools are installed!'));
      }

      // Step 2: Configure API keys
      if (!options.skipKeys) {
        const keys = await onboardUtils.promptForApiKeys();

        if (keys.openrouter || keys.elevenlabs) {
          spinner.text = 'Saving API keys...';
          spinner.start();

          const config: onboardUtils.OnboardConfig = {
            openrouterApiKey: keys.openrouter,
            elevenlabsApiKey: keys.elevenlabs,
            onboardedAt: new Date().toISOString(),
          };

          await onboardUtils.saveOnboardConfig(config);

          spinner.succeed(chalk.green('API keys saved!'));

          console.log('\n' + chalk.bold('Saved Configuration:'));
          console.log(`  OpenRouter API Key: ${keys.openrouter ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
          console.log(`  ElevenLabs API Key: ${keys.elevenlabs ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
          console.log(`  Config File: ${chalk.dim(onboardUtils.getOnboardConfigPath())}`);
        } else {
          console.log(chalk.yellow('\nNo API keys configured.'));
          console.log(chalk.dim('You can add them later by running: screenwright onboard --skip-tools'));
        }
      }

      // Load keys into environment
      await onboardUtils.loadAllApiKeysToEnv();

      console.log('\n' + chalk.bold(chalk.green('Onboarding Complete!')));
      console.log('\nNext steps:');
      console.log(`  ${chalk.cyan('screenwright init')}    Initialize a project`);
      console.log(`  ${chalk.cyan('screenwright launch')}   Launch your app`);
      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Onboarding failed'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

program
  .command('config:keys')
  .description('Show or update API keys configuration')
  .option('-s, --show', 'Show configured keys (hidden)')
  .option('-u, --update', 'Update API keys')
  .action(async (options) => {
    const config = await onboardUtils.loadOnboardConfig();

    if (!options.update) {
      // Show current configuration
      if (!config) {
        console.log(chalk.yellow('\nNo API keys configured.'));
        console.log(chalk.dim('Run "screenwright onboard --skip-tools" to configure API keys.\n'));
        return;
      }

      console.log(chalk.bold('\nAPI Keys Configuration:\n'));
      console.log(`  OpenRouter API Key: ${config.openrouterApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
      console.log(`  ElevenLabs API Key: ${config.elevenlabsApiKey ? chalk.green('✓ Configured') : chalk.red('✗ Not set')}`);
      console.log(`  Config File: ${chalk.dim(onboardUtils.getOnboardConfigPath())}`);
      console.log(`  Last Updated: ${chalk.dim(new Date(config.onboardedAt).toLocaleString())}`);
      console.log();
    } else {
      // Update API keys
      console.log(chalk.bold('\nUpdate API Keys\n'));

      const keys = await onboardUtils.promptForApiKeys();

      const newConfig: onboardUtils.OnboardConfig = {
        openrouterApiKey: keys.openrouter || config?.openrouterApiKey,
        elevenlabsApiKey: keys.elevenlabs || config?.elevenlabsApiKey,
        onboardedAt: new Date().toISOString(),
      };

      await onboardUtils.saveOnboardConfig(newConfig);
      await onboardUtils.loadAllApiKeysToEnv();

      console.log(chalk.green('\nAPI keys updated!\n'));
    }
  });

// ============================================================================
// INIT COMMAND
// ============================================================================
program
  .command('init')
  .description('Initialize .instructions folder in current project')
  .option('-f, --force', 'Reinitialize even if .instructions already exists')
  .action(async (options) => {
    const projectPath = getCwd();
    const spinner = ora('Initializing project...').start();

    try {
      // Detect project type
      spinner.text = 'Detecting project type...';
      const projectType = await detectUtils.detectProjectType(projectPath);

      if (projectType === 'unknown') {
        spinner.fail(chalk.red('Could not detect project type'));
        console.log(chalk.yellow('\nSupported project types:'));
        console.log('  • Expo (package.json contains "expo" dependency)');
        console.log('  • React Native (package.json contains "react-native" dependency)');
        console.log('  • Native iOS (contains .xcodeproj or .xcworkspace)');
        process.exit(1);
      }

      // Initialize .instructions folder
      spinner.text = 'Creating .instructions folder...';
      const config = await configUtils.initializeInstructions(projectPath, options.force);

      spinner.succeed(chalk.green('Project initialized successfully!'));
      console.log('\n' + chalk.bold('Project Details:'));
      console.log(`  Type: ${formatProjectType(config.projectType)}`);
      console.log(`  Path: ${config.projectPath}`);
      console.log('\n' + chalk.bold('Created:'));
      console.log(`  ${chalk.cyan('.instructions/config.json')} - Configuration file`);
      console.log(`  ${chalk.cyan('.instructions/.gitignore')} - Git ignore rules`);
      console.log('\n' + chalk.bold('Default Preferences:'));
      console.log(`  Device: ${config.preferences.defaultDevice}`);
      console.log(`  Cache: ${config.preferences.defaultUseCache ? 'enabled' : 'disabled'}`);
      console.log(`  Clean: ${config.preferences.defaultClean ? 'enabled' : 'disabled'}`);
      console.log('\n' + chalk.dim('Run "screenwright launch" to start your app in a simulator'));

    } catch (error) {
      spinner.fail(chalk.red('Initialization failed'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// CONFIG COMMAND
// ============================================================================
program
  .command('config')
  .description('Manage .instructions configuration')
  .option('--get <key>', 'Get a configuration value')
  .option('--set <key>=<value>', 'Set a configuration value')
  .option('--show', 'Show full configuration')
  .action(async (options) => {
    const projectPath = getCwd();

    try {
      if (!await configUtils.hasInstructions(projectPath)) {
        console.error(chalk.red('No .instructions folder found'));
        console.error(chalk.yellow('Run "screenwright init" to initialize your project'));
        process.exit(1);
      }

      if (options.show) {
        const config = await configUtils.loadConfig(projectPath);
        console.log(JSON.stringify(config, null, 2));
      } else if (options.get) {
        const value = await configUtils.getPreference(projectPath, options.get as any);
        console.log(value !== undefined ? JSON.stringify(value, null, 2) : 'undefined');
      } else if (options.set) {
        const [key, value] = options.set.split('=');
        await configUtils.setPreference(projectPath, key as any, JSON.parse(value));
        console.log(chalk.green(`Set ${key} = ${value}`));
      } else {
        const config = await configUtils.loadConfig(projectPath);
        console.log(chalk.bold('\nConfiguration:\n'));
        console.log(`  Type: ${formatProjectType(config!.projectType)}`);
        console.log(`  Version: ${config!.version}`);
        console.log(`  Updated: ${config!.lastUpdated}\n`);
        console.log(chalk.bold('Preferences:'));
        for (const [key, value] of Object.entries(config!.preferences)) {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
      }
    } catch (error) {
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// INFO COMMAND
// ============================================================================
program
  .command('info')
  .description('Show information about the current project')
  .action(async () => {
    const projectPath = getCwd();
    const spinner = ora('Analyzing project...').start();

    try {
      // Check for .instructions
      const hasInstructions = await configUtils.hasInstructions(projectPath);
      const config = hasInstructions ? await configUtils.loadConfig(projectPath) : null;

      // Detect project type
      const projectType = config?.projectType || await detectUtils.detectProjectType(projectPath);

      spinner.stop();

      console.log(chalk.bold('\nProject Information\n'));

      console.log(chalk.bold('Path:'));
      console.log(`  ${projectPath}`);

      console.log(chalk.bold('\nType:'));
      console.log(`  ${formatProjectType(projectType)}`);

      if (hasInstructions && config) {
        console.log(chalk.bold('\n.instructions:'));
        console.log(`  ${chalk.green('Initialized')}`);
        console.log(`  Version: ${config.version}`);
        console.log(`  Updated: ${config.lastUpdated}`);

        console.log(chalk.bold('\nPreferences:'));
        for (const [key, value] of Object.entries(config.preferences)) {
          console.log(`  ${key}: ${JSON.stringify(value)}`);
        }
      } else {
        console.log(chalk.bold('\n.instructions:'));
        console.log(`  ${chalk.yellow('Not initialized')}`);
        console.log(`  Run ${chalk.cyan('screenwright init')} to initialize`);
      }

      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Failed to get project info'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// CONTENT COMMANDS
// ============================================================================
const contentCmd = program.command('content');
contentCmd.description('Manage content ideas');

contentCmd
  .command('generate')
  .description('Generate content ideas from your project codebase')
  .option('-n, --max-ideas <number>', 'Maximum number of ideas to generate', '10')
  .option('-c, --max-categories <number>', 'Maximum number of categories', '3')
  .action(async (options) => {
    const projectPath = getCwd();
    const spinner = ora('Generating content ideas...').start();

    try {
      if (!await configUtils.hasInstructions(projectPath)) {
        spinner.fail(chalk.red('Project not initialized'));
        console.error(chalk.yellow('Run "screenwright init" to initialize your project first'));
        process.exit(1);
      }

      const maxIdeas = parseInt(options.maxIdeas) || 10;
      const maxCategories = parseInt(options.maxCategories) || 3;

      spinner.text = 'Analyzing codebase...';
      const categories = await contentGenerator.generateAndSaveContentIdeas(projectPath, {
        maxIdeas,
        maxCategories,
      });

      spinner.succeed(chalk.green(`Generated ${categories.reduce((sum, c) => sum + c.content.length, 0)} content ideas!`));

      console.log('\n' + chalk.bold('Generated Categories:\n'));

      for (const category of categories) {
        console.log(`${chalk.cyan(category.name)}`);
        console.log(`  ${chalk.gray(category.description)}\n`);

        for (const idea of category.content) {
          console.log(`  ${chalk.white('•')} ${chalk.bold(idea.title)}`);
          console.log(`    ${chalk.gray(idea.description)}`);
        }
        console.log();
      }

      console.log(chalk.dim(`Run "screenwright content list" to see all ideas`));
      console.log(chalk.dim(`Run "screenwright video create <idea-id>" to create a video from an idea`));

    } catch (error) {
      spinner.fail(chalk.red('Failed to generate content'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

contentCmd
  .command('list')
  .description('List all generated content ideas')
  .option('-c, --category <name>', 'Filter by category')
  .action(async (options) => {
    const projectPath = getCwd();
    const spinner = ora('Loading content ideas...').start();

    try {
      const ideas = await videoStorage.getContentIdeas(projectPath);
      spinner.stop();

      if (ideas.length === 0) {
        console.log(chalk.yellow('\nNo content ideas found'));
        console.log(chalk.dim(`Run "screenwright content generate" to generate ideas\n`));
        return;
      }

      let filteredIdeas = ideas;
      if (options.category) {
        filteredIdeas = ideas.filter(i => i.category === options.category);
      }

      console.log(chalk.bold(`\nContent Ideas (${filteredIdeas.length} total):\n`));

      // Group by category
      const byCategory: Record<string, ContentIdea[]> = {};
      for (const idea of filteredIdeas) {
        const cat = idea.category || 'Uncategorized';
        if (!byCategory[cat]) byCategory[cat] = [];
        byCategory[cat].push(idea);
      }

      for (const [category, categoryIdeas] of Object.entries(byCategory)) {
        console.log(`${chalk.cyan(category)}`);
        for (const idea of categoryIdeas) {
          console.log(`  ${chalk.white('•')} ${chalk.bold(idea.title)}`);
          console.log(`    ${chalk.gray(idea.description)}`);
          console.log(`    ${chalk.dim(`ID: ${idea.id}`)}`);
        }
        console.log();
      }

    } catch (error) {
      spinner.fail(chalk.red('Failed to load content'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// VIDEOS COMMAND
// ============================================================================
program
  .command('videos')
  .description('List all videos')
  .action(async () => {
    const projectPath = getCwd();
    const spinner = ora('Loading videos...').start();

    try {
      const videos = await videoStorage.listVideos(projectPath);
      spinner.stop();

      if (videos.length === 0) {
        console.log(chalk.yellow('\nNo videos found'));
        console.log(chalk.dim(`Run "screenwright content generate" to generate content ideas\n`));
        console.log(chalk.dim(`Run "screenwright video create <idea-id>" to create a video\n`));
        return;
      }

      console.log(chalk.bold(`\nVideos (${videos.length} total):\n`));

      for (const video of videos) {
        console.log(`${chalk.cyan(video.title)}`);
        console.log(`  ID: ${chalk.dim(video.id)}`);
        console.log(`  Stage: ${formatVideoStage(video.currentStage)}`);
        console.log(`  Created: ${chalk.dim(new Date(video.createdAt).toLocaleString())}`);
        if (video.error) {
          console.log(`  ${chalk.red(`Error: ${video.error}`)}`);
        }
        console.log();
      }

    } catch (error) {
      spinner.fail(chalk.red('Failed to load videos'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// VIDEO COMMANDS
// ============================================================================
const videoCmd = program.command('video');
videoCmd.description('Manage individual videos');

videoCmd
  .command('create <ideaId>')
  .description('Create a new video from a content idea')
  .action(async (ideaId) => {
    const projectPath = getCwd();
    const spinner = ora('Creating video...').start();

    try {
      const ideas = await videoStorage.getContentIdeas(projectPath);
      const idea = ideas.find(i => i.id === ideaId);

      if (!idea) {
        spinner.fail(chalk.red('Idea not found'));
        console.error(chalk.yellow(`Run "screenwright content list" to see available ideas`));
        process.exit(1);
      }

      const video = await videoStorage.createVideo(projectPath, idea);

      spinner.succeed(chalk.green(`Video created: ${video.title}`));
      console.log(`\n${chalk.bold('Video Details:')}`);
      console.log(`  ID: ${chalk.dim(video.id)}`);
      console.log(`  Title: ${chalk.white(video.title)}`);
      console.log(`  Stage: ${formatVideoStage(video.currentStage)}`);
      console.log(`\n${chalk.dim('Next steps:')}`);
      console.log(`  ${chalk.cyan(`screenwright video ${video.id} plan`)} - Generate recording plan`);
      console.log(`  ${chalk.cyan(`screenwright video ${video.id} all`)} - Run all stages`);
      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Failed to create video'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

videoCmd
  .command('status')
  .description('Show detailed status of a video (interactive if no videoId provided)')
  .action(async (videoId) => {
    const projectPath = getCwd();
    let spinner: Ora | null = ora('Loading video status...').start();

    try {
      if (videoId) {
        // Use provided videoId
        spinner.stop();
      } else {
        // Interactive video selection
        spinner.stop();
        const video = await selectVideo(projectPath);
        if (!video) {
          return;
        }
        videoId = video.id;
        spinner = ora(`Loading video status for: ${video.title}...`).start();
      }

      const video = await videoStorage.getVideo(projectPath, videoId);

      if (!video) {
        spinner.fail(chalk.red('Video not found'));
        process.exit(1);
      }

      spinner.stop();

      console.log(chalk.bold(`\nVideo: ${video.title}\n`));
      console.log(`${chalk.bold('ID:')} ${video.id}`);
      console.log(`${chalk.bold('Description:')} ${video.description}`);
      console.log(`${chalk.bold('Feature:')} ${video.feature}`);
      console.log(`${chalk.bold('Current Stage:')} ${formatVideoStage(video.currentStage)}`);
      console.log(`${chalk.bold('Created:')} ${new Date(video.createdAt).toLocaleString()}`);
      console.log(`${chalk.bold('Updated:')} ${new Date(video.updatedAt).toLocaleString()}`);

      if (video.simulatorUdid) {
        console.log(`${chalk.bold('Simulator UDID:')} ${video.simulatorUdid}`);
      }

      if (video.error) {
        console.log(`\n${chalk.red.bold('Error:')} ${video.error}`);
      }

      console.log(`\n${chalk.bold('Stage Progress:')}`);
      const stages = [
        { key: 'idea', label: 'Idea' },
        { key: 'plan', label: 'Plan' },
        { key: 'script', label: 'Script' },
        { key: 'record', label: 'Record' },
        { key: 'composite', label: 'Composite' },
      ] as const;

      for (const stage of stages) {
        const s = video.stages[stage.key];
        const status = s.completed ? chalk.green('✓') : chalk.gray('○');
        const time = s.at ? `(${chalk.dim(new Date(s.at).toLocaleTimeString())})` : '';
        console.log(`  ${status} ${stage.label.padEnd(10)} ${time}`);
      }

      console.log();

    } catch (error) {
      spinner.fail(chalk.red('Failed to load video status'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

videoCmd
  .command('delete')
  .description('Delete a video (interactive if no videoId provided)')
  .action(async (videoId) => {
    const projectPath = getCwd();
    let spinner: Ora | null = ora('Deleting video...').start();

    try {
      if (videoId) {
        // Use provided videoId
        spinner.stop();
      } else {
        // Interactive video selection
        spinner.stop();
        const video = await selectVideo(projectPath);
        if (!video) {
          return;
        }
        videoId = video.id;
        spinner = ora(`Deleting: ${video.title}...`).start();
      }

      const success = await videoStorage.deleteVideo(projectPath, videoId);

      if (!success) {
        spinner.fail(chalk.red('Video not found'));
        process.exit(1);
      }

      spinner.succeed(chalk.green('Video deleted'));

    } catch (error) {
      spinner.fail(chalk.red('Failed to delete video'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// Stage commands
const stages = ['plan', 'script', 'record', 'composite'] as const;

for (const stage of stages) {
  videoCmd
    .command(`${stage}`)
    .description(`Run ${stage} stage for a video (interactive if no videoId provided)`)
    .option('-d, --device <udid>', 'Simulator UDID to use')
    .action(async (videoId, options) => {
      const projectPath = getCwd();
      let spinner: Ora | null = ora(`Running ${stage} stage...`).start();

      try {
        if (videoId) {
          // Use provided videoId
          spinner.stop();
        } else {
          // Interactive video selection
          spinner.stop();
          const video = await selectVideo(projectPath);
          if (!video) {
            return;
          }
          videoId = video.id;
          spinner = ora(`Running ${stage} stage for: ${video.title}...`).start();
        }

        const video = await videoStorage.getVideo(projectPath, videoId);

        if (!video) {
          spinner.fail(chalk.red('Video not found'));
          process.exit(1);
        }

        spinner.info(chalk.yellow(`${stage.toUpperCase()} stage requires full agent integration`));
        spinner.info(chalk.dim('This is a placeholder for the actual implementation'));

        // TODO: Implement actual stage execution
        // This would call the respective agent (planner, scriptwriter, recorder, compositor)

        spinner.succeed(chalk.green(`${stage} stage completed (placeholder)`));

      } catch (error) {
        spinner?.fail(chalk.red(`Failed to run ${stage} stage`));
        console.error(chalk.red(error instanceof Error ? error.message : String(error)));
        process.exit(1);
      }
    });
}

videoCmd
  .command('all')
  .description('Run all stages for a video (interactive if no videoId provided)')
  .option('-d, --device <udid>', 'Simulator UDID to use')
  .action(async (options) => {
    const projectPath = getCwd();
    let spinner: Ora | null = ora('Running all stages...').start();

    try {
      let videoId: string | undefined = undefined;

      // Interactive video selection if no videoId provided
      if (!options.videoId) {
        spinner.stop();
        const video = await selectVideo(projectPath);
        if (!video) {
          return;
        }
        videoId = video.id;
        spinner = ora(`Running all stages for: ${video.title}...`).start();
      }

      const video = await videoStorage.getVideo(projectPath, videoId!);

      if (!video) {
        spinner.fail(chalk.red('Video not found'));
        process.exit(1);
      }

      spinner.info(chalk.yellow('FULL PIPELINE requires AI agent integration'));
      spinner.info(chalk.dim('This is a placeholder for the actual implementation'));

      // TODO: Implement full pipeline
      // 1. Run planner stage
      // 2. Run scriptwriter stage
      // 3. Run recorder stage
      // 4. Run compositor stage

      spinner.succeed(chalk.green('All stages completed (placeholder)'));

    } catch (error) {
      spinner?.fail(chalk.red('Failed to run all stages'));
      console.error(chalk.red(error instanceof Error ? error.message : String(error)));
      process.exit(1);
    }
  });

// ============================================================================
// PARSE AND RUN
// ============================================================================
program.parse();
