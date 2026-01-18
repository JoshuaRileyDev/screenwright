# Screenwright CLI

An AI-powered CLI tool for creating tutorial videos from your iOS app codebase. Analyzes your Expo or React Native project and generates video content plans, then orchestrates the full video creation pipeline.

## Features

- **AI Content Generation**: Analyzes your codebase to generate tutorial video ideas
- **Video Pipeline**: Plan → Script → Record → Composite
- **Smart Onboarding**: Automatically checks and installs required tools
- **API Key Management**: Securely stores OpenRouter and ElevenLabs API keys
- **Project Configuration**: `.instructions` folder for project-specific settings

## Installation

```bash
# Clone and install
cd instructionsCreator/cli
bun install

# Optional: Link globally for use anywhere
bun link
```

## Prerequisites

- macOS with Xcode installed
- Xcode Command Line Tools: `xcode-select --install`
- Node.js 18+ and Bun (for running from source)
- FFmpeg (auto-installed during onboarding)
- AXe CLI (auto-installed during onboarding)
- API keys from OpenRouter and ElevenLabs (configured during onboarding)

## Quick Start

### 1. Onboard (First Time Setup)

```bash
screenwright onboard
```

This will:
- Check for required tools (Xcode, FFmpeg, AXe CLI)
- Install missing tools automatically
- Prompt for API keys (OpenRouter, ElevenLabs)
- Store configuration in `~/.screenwright/config.json`

**Example:**
```bash
$ screenwright onboard

Tool Check Results:

  ✓ Xcode (/Applications/Xcode.app)
  ✓ simctl
  ✓ FFmpeg (7.1.1)
  ✗ AXe CLI
    Install: npm install -g @axe-devtools/cli

Installing Missing Tools...
✔ AXe CLI installed

==================================================
API Keys Configuration
==================================================

Screenwright uses AI services for video creation.

OpenRouter API Key (for AI planning and script generation)
  Get your key at: https://openrouter.ai/keys
  This is used for: Planning, Script generation
  Cost: ~$0.01 per video (varies by model)
Enter OpenRouter API Key (or press Enter to skip): [sk-or-...]

ElevenLabs API Key (for AI voiceover generation)
  Get your key at: https://elevenlabs.io/app/settings/api-keys
  This is used for: Voiceover audio generation
  Cost: ~$0.30 per 1k characters (varies by voice)
Enter ElevenLabs API Key (or press Enter to skip): [xxxxxxxx...]

✔ API keys saved!

Onboarding Complete!

Next steps:
  screenwright init    Initialize a project
  screenwright content generate  Generate content ideas
```

**Onboarding Options:**
- `--skip-tools` - Skip tool checking and only configure API keys
- `--skip-keys` - Skip API key configuration
- `--force` - Re-run onboarding even if already completed

### 2. Initialize Your Project

```bash
cd /path/to/your/project
screenwright init
```

This creates a `.instructions` folder in your project root with:
- `config.json` - Your project configuration
- `.gitignore` - Ensures cache files aren't committed
- `videos.json` - Stores content ideas and videos

## Commands

### `screenwright onboard`

Set up Screenwright - check tools, install dependencies, and configure API keys.

```bash
screenwright onboard [options]
```

**Options:**
- `-s, --skip-tools` - Skip tool checking and only configure API keys
- `-k, --skip-keys` - Skip API key configuration
- `-f, --force` - Re-run onboarding even if already completed

### `screenwright config:keys`

Show or update API keys configuration.

```bash
screenwright config:keys          # Show API key status
screenwright config:keys --update # Update API keys
```

### `screenwright init`

Initialize the `.instructions` folder in your project.

```bash
screenwright init [--force]
```

**Options:**
- `-f, --force` - Reinitialize even if `.instructions` already exists

**What it does:**
- Detects your project type (Expo, React Native, or native iOS)
- Creates `.instructions/config.json` with default preferences
- Creates `.instructions/.gitignore` to exclude cache files

### `screenwright config`

Manage `.instructions` configuration.

```bash
screenwright config                    # Show configuration summary
screenwright config --show               # Show full configuration
screenwright config --get <key>       # Get a configuration value
screenwright config --set <key>=<value> # Set a configuration value
```

### `screenwright info`

Show information about the current project.

```bash
screenwright info
```

### Content Commands

#### `screenwright content generate`

Generate video content ideas by analyzing your project codebase.

```bash
screenwright content generate [options]
```

**Options:**
- `-n, --max-ideas <number>` - Maximum number of ideas to generate (default: 10)
- `-c, --max-categories <number>` - Maximum number of categories (default: 3)

**What it does:**
- Analyzes your project structure to identify features and screens
- Generates tutorial video ideas organized by category
- Saves ideas to `.instructions/videos.json`

**Example:**
```bash
$ screenwright content generate
Generating content ideas...
✓ Generated 8 content ideas!

Generated Categories:

Getting Started
  Learn the basics of using MyApp

  • Getting Started with MyApp
    A quick introduction to MyApp and its main features

Core Features
  Learn how to use MyApp's main features

  • Creating a Post
    Learn how to create and share posts on MyApp
  • Searching for Content
    Learn how to search and find content on MyApp
```

#### `screenwright content list`

List all generated content ideas.

```bash
screenwright content list [options]
```

**Options:**
- `-c, --category <name>` - Filter by category

### Video Commands

#### `screenwright videos`

List all videos.

```bash
screenwright videos
```

#### `screenwright video create <ideaId>`

Create a new video from a content idea.

```bash
screenwright video create <ideaId>
```

#### `screenwright video status <videoId>`

Show detailed status of a video.

```bash
screenwright video status <videoId>
```

#### `screenwright video plan <videoId>`

Generate recording plan using AI (analyzes simulator, tests interactions).

```bash
screenwright video plan <videoId>
```

#### `screenwright video script <videoId>`

Generate voiceover script with precise timestamps.

```bash
screenwright video script <videoId>
```

#### `screenwright video record <videoId>`

Record the video on simulator.

```bash
screenwright video record <videoId>
```

#### `screenwright video composite <videoId>`

Combine video and audio.

```bash
screenwright video composite <videoId>
```

#### `screenwright video all <videoId>`

Run all stages (plan, script, record, composite).

```bash
screenwright video all <videoId>
```

This runs the complete video creation pipeline:
1. **Plan**: Uses AI to analyze the simulator and generate a detailed recording plan
2. **Script**: Generates a voiceover script with precise timestamps
3. **Record**: Executes the recording on the simulator
4. **Composite**: Combines the video with AI-generated voiceover

#### `screenwright video delete <videoId>`

Delete a video.

```bash
screenwright video delete <videoId>
```

## Video Pipeline Architecture

The video creation system consists of four stages, each building on the previous:

### Stage 1: Plan
- **AI Agent**: Uses OpenRouter API with vision capabilities
- **Process**:
  - Takes screenshots of the simulator
  - Lists UI elements with coordinates
  - Tests each interaction (tap, swipe, type)
  - Generates a detailed recording plan with exact coordinates
- **Output**: Recording plan with setup steps and recording steps

### Stage 2: Script
- **AI Agent**: Uses OpenRouter API
- **Process**:
  - Analyzes the recording plan
  - Generates a natural, conversational voiceover script
  - Calculates precise timestamps for each action
- **Output**: Voiceover script with timestamped actions

### Stage 3: Record
- **Tool**: Uses AXe CLI for simulator control
- **Process**:
  - Executes setup steps before recording
  - Starts screen recording
  - Executes actions at precise timestamps
  - Stops recording
- **Output**: Silent video file

### Stage 4: Composite
- **Tool**: Uses FFmpeg
- **Process**:
  - Generates AI voiceover using ElevenLabs
  - Combines video and audio
  - Outputs final video file
- **Output**: Final video with voiceover

**Required API Keys:**
- `OPENROUTER_API_KEY` - For AI agents (planner, scriptwriter)
- `ELEVENLABS_API_KEY` - For voiceover generation

## Configuration

### Project Configuration (`.instructions/config.json`)

Stored in your project root:

```json
{
  "version": "1.0.0",
  "projectPath": "/Users/john/my-app",
  "projectType": "expo",
  "createdAt": "2024-01-15T10:30:00.000Z",
  "lastUpdated": "2024-01-15T10:30:00.000Z",
  "preferences": {
    "defaultDevice": "iPhone 15 Pro",
    "defaultUseCache": true,
    "defaultClean": false
  }
}
```

### Global Configuration (`~/.screenwright/config.json`)

API keys stored globally:

```json
{
  "openrouterApiKey": "sk-or-...",
  "elevenlabsApiKey": "...",
  "onboardedAt": "2024-01-15T10:30:00.000Z"
}
```

## SDK

Screenwright also provides an SDK for programmatic access:

```bash
npm install @screenwright/sdk
```

```typescript
import * as screenwright from '@screenwright/sdk';

// Generate content ideas
const categories = await screenwright.generateAndSaveContentIdeas(projectPath, {
  maxIdeas: 10,
  maxCategories: 3
});

// Create a video
const video = await screenwright.createVideo(projectPath, idea);

// Check video status
const status = await screenwright.getVideo(projectPath, videoId);
```

## Development

### Building from Source

```bash
# Build SDK
cd sdk && bun run build

# Build CLI
cd cli && bun run build
```

### Running in Development Mode

```bash
cd cli
bun run dev
```

### Project Structure

```
instructionsCreator/
├── sdk/                    # @screenwright/sdk
│   ├── src/
│   │   ├── index.ts       # Main exports
│   │   ├── types.ts       # Core types
│   │   ├── types-video.ts # Video types
│   │   └── utils/
│   │       ├── detect.ts
│   │       ├── config.ts
│   │       ├── video-storage.ts
│   │       ├── content-generator.ts
│   │       └── onboard.ts
│   ├── dist/              # Built SDK
│   ├── package.json
│   └── tsconfig.json
└── cli/                    # screenwright CLI
    ├── src/
    │   └── cli.ts         # CLI entry point (uses SDK)
    ├── dist/              # Built CLI
    └── package.json
```

## Workflow Example

```bash
# 1. First-time setup
screenwright onboard

# 2. Initialize project
cd my-expo-app
screenwright init

# 3. Generate content ideas
screenwright content generate

# 4. List content ideas
screenwright content list

# 5. Create a video from an idea
screenwright video create idea_xxxxx

# 6. Generate recording plan
screenwright video plan video_xxxxx

# 7. Generate script
screenwright video script video_xxxxx

# 8. Record the video
screenwright video record video_xxxxx

# 9. Composite final video
screenwright video composite video_xxxxx

# OR run all stages at once
screenwright video all video_xxxxx
```

## Troubleshooting

### "Xcode not installed" Error

```bash
xcode-select --install
xcode-select -p
```

### "Could not detect project type" Error

Screenwright looks for specific project indicators:
- **Expo**: `package.json` contains `"expo"` dependency OR `app.json` exists
- **React Native**: `package.json` contains `"react-native"` dependency
- **Native iOS**: `ios/` directory contains `.xcodeproj` or `.xcworkspace`

### API Key Issues

```bash
# Check API key status
screenwright config:keys

# Update API keys
screenwright config:keys --update
```

## License

MIT

## Acknowledgments

Built with:
- [Commander.js](https://commander.js/) - CLI framework
- [Chalk](https://chalk.js/) - Terminal styling
- [Ora](https://github.com/sindresorhus/ora) - Terminal spinners
- [Bun](https://bun.sh/) - JavaScript runtime
