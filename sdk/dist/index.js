import { createRequire } from "node:module";
var __create = Object.create;
var __getProtoOf = Object.getPrototypeOf;
var __defProp = Object.defineProperty;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __toESM = (mod, isNodeMode, target) => {
  target = mod != null ? __create(__getProtoOf(mod)) : {};
  const to = isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target;
  for (let key of __getOwnPropNames(mod))
    if (!__hasOwnProp.call(to, key))
      __defProp(to, key, {
        get: () => mod[key],
        enumerable: true
      });
  return to;
};
var __require = /* @__PURE__ */ createRequire(import.meta.url);
// src/utils/detect.ts
async function detectProjectType(projectPath) {
  const iosDirExists = await fileExists(`${projectPath}/ios`);
  if (iosDirExists) {
    const xcodeProjExists = await findFile(projectPath, ".xcodeproj");
    const xcworkspaceExists = await findFile(projectPath, ".xcworkspace");
    if (xcodeProjExists || xcworkspaceExists) {
      return "native-ios";
    }
  }
  const packageJsonPath = `${projectPath}/package.json`;
  const packageJsonExists = await fileExists(packageJsonPath);
  if (packageJsonExists) {
    try {
      const packageFile = Bun.file(packageJsonPath);
      const packageJson = await packageFile.json();
      if (packageJson.dependencies?.expo || packageJson.devDependencies?.expo) {
        return "expo";
      }
      if (packageJson.dependencies?.["react-native"] || packageJson.devDependencies?.["react-native"]) {
        return "react-native";
      }
    } catch {}
  }
  const expoConfigFiles = ["app.json", "app.config.js", "app.config.ts"];
  for (const configFile of expoConfigFiles) {
    if (await fileExists(`${projectPath}/${configFile}`)) {
      return "expo";
    }
  }
  return "unknown";
}
async function getExpoAppConfig(projectPath) {
  try {
    const appJsonPath = `${projectPath}/app.json`;
    const appJsonFile = Bun.file(appJsonPath);
    if (await appJsonFile.exists()) {
      const appJson = await appJsonFile.json();
      return {
        scheme: appJson.expo?.scheme || null,
        bundleId: appJson.expo?.ios?.bundleIdentifier || null
      };
    }
  } catch {}
  return { scheme: null, bundleId: null };
}
async function fileExists(path) {
  try {
    const file = Bun.file(path);
    return await file.exists();
  } catch {
    return false;
  }
}
async function findFile(dir, extension) {
  try {
    const proc = Bun.spawn(["find", dir, "-name", `*${extension}`, "-maxdepth", "3"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await proc.exited;
    return proc.exitCode === 0;
  } catch {
    return false;
  }
}
async function getNativeIosProjectPath(projectPath) {
  const workspaceProc = Bun.spawn(["find", `${projectPath}/ios`, "-name", "*.xcworkspace", "-maxdepth", "2"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await workspaceProc.exited;
  if (workspaceProc.exitCode === 0) {
    const output = await new Response(workspaceProc.stdout).text();
    const workspacePath = output.trim().split(`
`)[0];
    if (workspacePath) {
      return workspacePath;
    }
  }
  const projectProc = Bun.spawn(["find", `${projectPath}/ios`, "-name", "*.xcodeproj", "-maxdepth", "2"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await projectProc.exited;
  if (projectProc.exitCode === 0) {
    const output = await new Response(projectProc.stdout).text();
    const projectPath2 = output.trim().split(`
`)[0];
    if (projectPath2) {
      return projectPath2;
    }
  }
  return null;
}
// src/utils/simulator.ts
async function listSimulators() {
  const proc = Bun.spawn(["xcrun", "simctl", "list", "devices", "-j"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error("Failed to list simulators. Make sure Xcode is installed.");
  }
  const output = await new Response(proc.stdout).text();
  const data = JSON.parse(output);
  const simulators = [];
  for (const runtime in data.devices) {
    const devices = data.devices[runtime];
    for (const device of devices) {
      simulators.push({
        udid: device.udid,
        name: device.name,
        deviceType: device.deviceTypeIdentifier || "unknown",
        runtime,
        state: device.state
      });
    }
  }
  return simulators;
}
async function getBootedSimulators() {
  const allSimulators = await listSimulators();
  return allSimulators.filter((sim) => sim.state === "Booted");
}
async function getAvailableSimulators() {
  const allSimulators = await listSimulators();
  return allSimulators.filter((sim) => sim.state === "Shutdown");
}
async function bootSimulator(udid) {
  const proc = Bun.spawn(["xcrun", "simctl", "boot", udid], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    const booted = await getBootedSimulators();
    if (booted.some((s) => s.udid === udid)) {
      return;
    }
    throw new Error(`Failed to boot simulator: ${udid}`);
  }
}
async function shutdownSimulator(udid) {
  const proc = Bun.spawn(["xcrun", "simctl", "shutdown", udid], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
}
async function createSimulator(name, deviceType, runtime) {
  const proc = Bun.spawn([
    "xcrun",
    "simctl",
    "create",
    name,
    deviceType,
    runtime
  ], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    const error = await new Response(proc.stderr).text();
    throw new Error(`Failed to create simulator: ${error}`);
  }
  const output = await new Response(proc.stdout).text();
  return output.trim();
}
async function deleteSimulator(udid) {
  const proc = Bun.spawn(["xcrun", "simctl", "delete", udid], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error("Failed to delete simulator");
  }
}
async function listAvailableDeviceTypes() {
  const proc = Bun.spawn(["xcrun", "simctl", "list", "devicetypes"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
  const output = await new Response(proc.stdout).text();
  return output.split(`
`).filter((line) => line.includes("com.apple.CoreSimulator.SimDeviceType")).map((line) => {
    const match = line.match(/\(([^)]+)\)/);
    return match ? match[1] : null;
  }).filter(Boolean);
}
async function listAvailableRuntimes() {
  const proc = Bun.spawn(["xcrun", "simctl", "list", "runtimes"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
  const output = await new Response(proc.stdout).text();
  const runtimes = output.split(`
`).filter((line) => line.includes("com.apple.CoreSimulator.SimRuntime.iOS")).map((line) => {
    const match = line.match(/com\.apple\.CoreSimulator\.SimRuntime\.iOS-[\d-]+/);
    return match ? match[0] : null;
  }).filter(Boolean);
  return Array.from(new Set(runtimes));
}
async function findSimulatorByDeviceModel(deviceModel) {
  const simulators = await listSimulators();
  return simulators.find((sim) => sim.name.toLowerCase().includes(deviceModel.toLowerCase())) || null;
}
async function findOrCreateSimulator(deviceModel = "iPhone 15 Pro") {
  const existing = await findSimulatorByDeviceModel(deviceModel);
  if (existing) {
    return existing;
  }
  const deviceTypes = await listAvailableDeviceTypes();
  const runtimes = await listAvailableRuntimes();
  const deviceType = deviceTypes.find((dt) => dt.toLowerCase().includes(deviceModel.toLowerCase().replace(/\s+/g, "-")));
  if (!deviceType) {
    throw new Error(`Device type "${deviceModel}" not found`);
  }
  const runtime = runtimes[runtimes.length - 1];
  const simulatorName = `${deviceModel.replace(/\s+/g, "-")}-${Date.now()}`;
  const udid = await createSimulator(simulatorName, deviceType, runtime);
  return {
    udid,
    name: simulatorName,
    deviceType,
    runtime,
    state: "Shutdown"
  };
}
async function waitForSimulatorReady(udid, timeoutMs = 120000) {
  const startTime = Date.now();
  while (Date.now() - startTime < timeoutMs) {
    const simulators = await listSimulators();
    const simulator = simulators.find((s) => s.udid === udid);
    if (simulator?.state === "Booted") {
      const statusProc = Bun.spawn(["xcrun", "simctl", "bootstatus", udid, "-b"], {
        stdout: "pipe",
        stderr: "pipe"
      });
      await statusProc.exited;
      if (statusProc.exitCode === 0) {
        return;
      }
    }
    await new Promise((resolve) => setTimeout(resolve, 2000));
  }
  throw new Error(`Simulator failed to be ready within ${timeoutMs}ms`);
}
async function openSimulatorApp() {
  const proc = Bun.spawn(["open", "-a", "Simulator"], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await proc.exited;
  if (proc.exitCode !== 0) {
    throw new Error("Failed to open Simulator app");
  }
}
async function openXcode(projectPath) {
  if (projectPath) {
    const workspaceProc = Bun.spawn(["find", projectPath, "-name", "*.xcworkspace", "-maxdepth", "3"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await workspaceProc.exited;
    if (workspaceProc.exitCode === 0) {
      const output = await new Response(workspaceProc.stdout).text();
      const workspacePath = output.trim().split(`
`)[0];
      if (workspacePath) {
        Bun.spawn(["open", workspacePath]);
        return;
      }
    }
    const projectProc = Bun.spawn(["find", projectPath, "-name", "*.xcodeproj", "-maxdepth", "3"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await projectProc.exited;
    if (projectProc.exitCode === 0) {
      const output = await new Response(projectProc.stdout).text();
      const projectPathStr = output.trim().split(`
`)[0];
      if (projectPathStr) {
        Bun.spawn(["open", projectPathStr]);
        return;
      }
    }
  }
  Bun.spawn(["open", "-a", "Xcode"]);
}
// src/utils/launch.ts
async function launchExpoApp(projectPath, simulatorUdid, useCache = false) {
  const appConfig = await getExpoAppConfig(projectPath);
  if (!appConfig.bundleId) {
    throw new Error('Could not find bundle identifier in app.json. Please add "ios.bundleIdentifier" to your expo config.');
  }
  console.log(`Building Expo app for simulator ${simulatorUdid}...`);
  console.log(`Bundle ID: ${appConfig.bundleId}`);
  const buildProc = Bun.spawn(["npx", "expo", "run:ios", "--device", simulatorUdid, "--configuration", "Release"], {
    cwd: projectPath,
    stdout: "inherit",
    stderr: "inherit"
  });
  await buildProc.exited;
  if (buildProc.exitCode !== 0) {
    throw new Error("Expo build failed");
  }
}
async function launchReactNativeApp(projectPath, simulatorUdid) {
  console.log(`Building React Native app for simulator ${simulatorUdid}...`);
  const buildProc = Bun.spawn(["npx", "react-native", "run-ios", "--simulator", simulatorUdid], {
    cwd: projectPath,
    stdout: "inherit",
    stderr: "inherit"
  });
  await buildProc.exited;
  if (buildProc.exitCode !== 0) {
    throw new Error("React Native build failed");
  }
}
async function launchNativeIosApp(projectPath, simulatorUdid, scheme) {
  const iosProjectPath = await getNativeIosProjectPath(projectPath);
  if (!iosProjectPath) {
    throw new Error("Could not find .xcworkspace or .xcodeproj in ios directory");
  }
  console.log(`Building native iOS app for simulator ${simulatorUdid}...`);
  console.log(`Project: ${iosProjectPath}`);
  const buildProc = Bun.spawn([
    "xcodebuild",
    "-workspace",
    iosProjectPath.includes(".xcworkspace") ? iosProjectPath : iosProjectPath.replace(".xcodeproj", ".xcworkspace"),
    "-scheme",
    scheme || "MyApp",
    "-sdk",
    "iphonesimulator",
    "-destination",
    `id=${simulatorUdid}`,
    "build"
  ], {
    cwd: projectPath,
    stdout: "inherit",
    stderr: "inherit"
  });
  await buildProc.exited;
  if (buildProc.exitCode !== 0) {
    throw new Error("iOS build failed");
  }
  console.log("Installing and launching app...");
  const derivedDataPath = `${process.env.HOME}/Library/Developer/Xcode/DerivedData`;
  const findProc = Bun.spawn([
    "find",
    derivedDataPath,
    "-name",
    "*.app",
    "-path",
    "*/Build/Products/Debug-iphonesimulator/*"
  ], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await findProc.exited;
  if (findProc.exitCode === 0) {
    const output = await new Response(findProc.stdout).text();
    const appPath = output.trim().split(`
`)[0];
    if (appPath) {
      const installProc = Bun.spawn(["xcrun", "simctl", "install", simulatorUdid, appPath], {
        stdout: "pipe",
        stderr: "pipe"
      });
      await installProc.exited;
      if (installProc.exitCode === 0) {
        const infoPlistPath = `${appPath}/Info.plist`;
        const bundleIdProc = Bun.spawn([
          "/usr/libexec/PlistBuddy",
          "-c",
          "Print :CFBundleIdentifier",
          infoPlistPath
        ], {
          stdout: "pipe",
          stderr: "pipe"
        });
        await bundleIdProc.exited;
        if (bundleIdProc.exitCode === 0) {
          const bundleId = (await new Response(bundleIdProc.stdout).text()).trim();
          const launchProc = Bun.spawn(["xcrun", "simctl", "launch", simulatorUdid, bundleId], {
            stdout: "pipe",
            stderr: "pipe"
          });
          await launchProc.exited;
        }
      }
    }
  }
}
async function launchProject(projectPath, simulatorUdid, projectType, options = {}) {
  const detectedType = projectType || await detectProjectType(projectPath);
  switch (detectedType) {
    case "expo":
      await launchExpoApp(projectPath, simulatorUdid, options.useCache);
      break;
    case "react-native":
      await launchReactNativeApp(projectPath, simulatorUdid);
      break;
    case "native-ios":
      await launchNativeIosApp(projectPath, simulatorUdid, options.scheme);
      break;
    default:
      throw new Error("Unknown project type. Could not determine how to launch the app.");
  }
}
// src/utils/config.ts
var INSTRUCTIONS_DIR = ".instructions";
var CONFIG_FILE = "config.json";
function getInstructionsDir(projectPath) {
  return `${projectPath}/${INSTRUCTIONS_DIR}`;
}
function getConfigPath(projectPath) {
  return `${getInstructionsDir(projectPath)}/${CONFIG_FILE}`;
}
async function hasInstructions(projectPath) {
  const configPath = getConfigPath(projectPath);
  const configFile = Bun.file(configPath);
  return await configFile.exists();
}
async function loadConfig(projectPath) {
  const configPath = getConfigPath(projectPath);
  const configFile = Bun.file(configPath);
  if (!await configFile.exists()) {
    return null;
  }
  try {
    return await configFile.json();
  } catch {
    return null;
  }
}
async function saveConfig(projectPath, config) {
  const instructionsDir = getInstructionsDir(projectPath);
  const configPath = getConfigPath(projectPath);
  const mkdirProc = Bun.spawn(["mkdir", "-p", instructionsDir], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await mkdirProc.exited;
  if (mkdirProc.exitCode !== 0) {
    throw new Error("Failed to create .instructions directory");
  }
  await Bun.write(configPath, JSON.stringify(config, null, 2));
}
async function createConfig(projectPath) {
  const projectType = await detectProjectType(projectPath);
  const now = new Date().toISOString();
  const config = {
    version: "1.0.0",
    projectPath,
    projectType,
    createdAt: now,
    lastUpdated: now,
    preferences: {
      defaultDevice: "iPhone 15 Pro",
      defaultUseCache: true,
      defaultClean: false
    }
  };
  await saveConfig(projectPath, config);
  return config;
}
async function updateConfig(projectPath, updates) {
  const config = await loadConfig(projectPath);
  if (!config) {
    return null;
  }
  const updatedConfig = {
    ...config,
    ...updates,
    lastUpdated: new Date().toISOString()
  };
  await saveConfig(projectPath, updatedConfig);
  return updatedConfig;
}
async function getPreference(projectPath, key) {
  const config = await loadConfig(projectPath);
  return config?.preferences[key];
}
async function setPreference(projectPath, key, value) {
  const config = await loadConfig(projectPath);
  if (!config) {
    throw new Error("No .instructions config found. Run `screenwright init` first.");
  }
  config.preferences[key] = value;
  config.lastUpdated = new Date().toISOString();
  await saveConfig(projectPath, config);
}
async function createGitIgnore(projectPath) {
  const gitignorePath = `${getInstructionsDir(projectPath)}/.gitignore`;
  const content = `# Dev Launcher - Instructions Folder
# This folder contains local development preferences and cache

# Ignore cache files
cache/

# Ignore temporary files
*.tmp
*.log
`;
  await Bun.write(gitignorePath, content);
}
async function initializeInstructions(projectPath, force = false) {
  const instructionsDir = getInstructionsDir(projectPath);
  if (!force && await hasInstructions(projectPath)) {
    const config2 = await loadConfig(projectPath);
    throw new Error(`Project already initialized. Found existing .instructions folder.
` + `Project type: ${config2?.projectType}
` + `Use --force to reinitialize.`);
  }
  const config = await createConfig(projectPath);
  await createGitIgnore(projectPath);
  return config;
}
// src/utils/video-storage.ts
var VIDEO_STORAGE_FILE = "videos.json";
function getVideoStoragePath(projectPath) {
  return `${getInstructionsDir(projectPath)}/${VIDEO_STORAGE_FILE}`;
}
async function loadVideoStorage(projectPath) {
  const storagePath = getVideoStoragePath(projectPath);
  const storageFile = Bun.file(storagePath);
  if (!await storageFile.exists()) {
    return null;
  }
  try {
    return await storageFile.json();
  } catch {
    return null;
  }
}
async function saveVideoStorage(projectPath, storage) {
  const storagePath = getVideoStoragePath(projectPath);
  await Bun.write(storagePath, JSON.stringify(storage, null, 2));
}
async function initializeVideoStorage(projectPath) {
  const storage = {
    version: "1.0.0",
    projectPath,
    videos: [],
    contentIdeas: []
  };
  await saveVideoStorage(projectPath, storage);
  return storage;
}
async function getOrCreateVideoStorage(projectPath) {
  let storage = await loadVideoStorage(projectPath);
  if (!storage) {
    storage = await initializeVideoStorage(projectPath);
  }
  return storage;
}
async function listVideos(projectPath) {
  const storage = await loadVideoStorage(projectPath);
  return storage?.videos || [];
}
async function getVideo(projectPath, videoId) {
  const videos = await listVideos(projectPath);
  return videos.find((v) => v.id === videoId) || null;
}
async function createVideo(projectPath, idea) {
  const storage = await getOrCreateVideoStorage(projectPath);
  const now = new Date().toISOString();
  const video = {
    id: `video_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    title: idea.title,
    description: idea.description,
    feature: idea.feature,
    category: idea.category,
    createdAt: now,
    updatedAt: now,
    currentStage: "idea",
    stages: {
      idea: { completed: true, at: now },
      plan: { completed: false },
      script: { completed: false },
      record: { completed: false },
      composite: { completed: false }
    }
  };
  storage.videos.push(video);
  await saveVideoStorage(projectPath, storage);
  return video;
}
async function updateVideoStage(projectPath, videoId, stage, data) {
  const storage = await getOrCreateVideoStorage(projectPath);
  const video = storage.videos.find((v) => v.id === videoId);
  if (!video) {
    return null;
  }
  const now = new Date().toISOString();
  video.stages[stage].completed = true;
  video.stages[stage].at = now;
  if (data && stage === "plan") {
    video.stages[stage].data = data;
  } else if (data && stage === "script") {
    video.stages[stage].data = data;
  }
  video.updatedAt = now;
  video.currentStage = stage;
  await saveVideoStorage(projectPath, storage);
  return video;
}
async function setVideoFailed(projectPath, videoId, error) {
  const storage = await getOrCreateVideoStorage(projectPath);
  const video = storage.videos.find((v) => v.id === videoId);
  if (!video) {
    return null;
  }
  video.currentStage = "failed";
  video.error = error;
  video.updatedAt = new Date().toISOString();
  await saveVideoStorage(projectPath, storage);
  return video;
}
async function deleteVideo(projectPath, videoId) {
  const storage = await getOrCreateVideoStorage(projectPath);
  const index = storage.videos.findIndex((v) => v.id === videoId);
  if (index === -1) {
    return false;
  }
  storage.videos.splice(index, 1);
  await saveVideoStorage(projectPath, storage);
  return true;
}
async function addContentIdeas(projectPath, ideas) {
  const storage = await getOrCreateVideoStorage(projectPath);
  const existingTitles = new Set(storage.contentIdeas.map((i) => i.title));
  const newIdeas = ideas.filter((i) => !existingTitles.has(i.title));
  storage.contentIdeas.push(...newIdeas);
  await saveVideoStorage(projectPath, storage);
}
async function getContentIdeas(projectPath) {
  const storage = await loadVideoStorage(projectPath);
  return storage?.contentIdeas || [];
}
function getVideoDir(projectPath, videoId) {
  return `${getInstructionsDir(projectPath)}/videos/${videoId}`;
}
async function createVideoDir(projectPath, videoId) {
  const dir = getVideoDir(projectPath, videoId);
  const mkdirProc = Bun.spawn(["mkdir", "-p", dir], {
    stdout: "pipe",
    stderr: "pipe"
  });
  await mkdirProc.exited;
  if (mkdirProc.exitCode !== 0) {
    throw new Error("Failed to create video directory");
  }
  return dir;
}
// src/utils/onboard.ts
import { mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
var SCREENWRIGHT_DIR = join(homedir(), ".screenwright");
var CONFIG_FILE2 = join(SCREENWRIGHT_DIR, "config.json");
function getOnboardConfigPath() {
  return CONFIG_FILE2;
}
async function loadOnboardConfig() {
  try {
    const file = Bun.file(CONFIG_FILE2);
    if (!await file.exists()) {
      return null;
    }
    return await file.json();
  } catch {
    return null;
  }
}
async function saveOnboardConfig(config) {
  await mkdir(SCREENWRIGHT_DIR, { recursive: true });
  await Bun.write(CONFIG_FILE2, JSON.stringify(config, null, 2));
}
async function checkXcode() {
  try {
    const proc = Bun.spawn(["xcode-select", "-p"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await proc.exited;
    if (proc.exitCode === 0) {
      const path = await new Response(proc.stdout).text();
      return {
        name: "Xcode",
        installed: true,
        version: path.trim(),
        required: true
      };
    }
  } catch {}
  return {
    name: "Xcode",
    installed: false,
    required: true,
    installCommand: "xcode-select --install",
    autoInstall: async () => {
      console.log("Opening App Store to install Xcode Command Line Tools...");
      console.log("Please complete the installation in the dialog that appears.");
      const proc = Bun.spawn(["xcode-select", "--install"], {
        stdout: "inherit",
        stderr: "inherit"
      });
      await proc.exited;
      return proc.exitCode === 0;
    }
  };
}
async function checkSimctl() {
  try {
    const proc = Bun.spawn(["xcrun", "simctl", "list"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await proc.exited;
    return {
      name: "simctl",
      installed: proc.exitCode === 0,
      required: true
    };
  } catch {
    return {
      name: "simctl",
      installed: false,
      required: true
    };
  }
}
async function checkFfmpeg() {
  try {
    const proc = Bun.spawn(["ffmpeg", "-version"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await proc.exited;
    if (proc.exitCode === 0) {
      const output = await new Response(proc.stdout).text();
      const versionMatch = output.match(/ffmpeg version (\S+)/);
      return {
        name: "FFmpeg",
        installed: true,
        version: versionMatch?.[1] || "unknown",
        required: true
      };
    }
  } catch {}
  return {
    name: "FFmpeg",
    installed: false,
    required: true,
    installCommand: "brew install ffmpeg",
    autoInstall: async () => {
      console.log("Installing FFmpeg via Homebrew...");
      const proc = Bun.spawn(["brew", "install", "ffmpeg"], {
        stdout: "inherit",
        stderr: "inherit"
      });
      await proc.exited;
      return proc.exitCode === 0;
    }
  };
}
async function checkAxe() {
  try {
    const proc = Bun.spawn(["axe", "--version"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await proc.exited;
    if (proc.exitCode === 0) {
      const output = await new Response(proc.stdout).text();
      return {
        name: "AXe CLI",
        installed: true,
        version: output.trim() || "unknown",
        required: true
      };
    }
  } catch {}
  return {
    name: "AXe CLI",
    installed: false,
    required: true,
    installCommand: "npm install -g @axe-devtools/cli",
    autoInstall: async () => {
      console.log("Installing AXe CLI globally via npm...");
      const proc = Bun.spawn(["npm", "install", "-g", "@axe-devtools/cli"], {
        stdout: "inherit",
        stderr: "inherit"
      });
      await proc.exited;
      return proc.exitCode === 0;
    }
  };
}
async function checkHomebrew() {
  try {
    const proc = Bun.spawn(["brew", "--version"], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await proc.exited;
    if (proc.exitCode === 0) {
      const output = await new Response(proc.stdout).text();
      return {
        name: "Homebrew",
        installed: true,
        version: output.trim() || "unknown",
        required: false
      };
    }
  } catch {}
  return {
    name: "Homebrew",
    installed: false,
    required: false,
    installCommand: '/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"'
  };
}
async function checkAllTools() {
  const results = await Promise.all([
    checkXcode(),
    checkSimctl(),
    checkFfmpeg(),
    checkAxe(),
    checkHomebrew()
  ]);
  return results;
}
async function hasAllRequiredTools() {
  const checks = await checkAllTools();
  return checks.filter((c) => c.required).every((c) => c.installed);
}
async function promptForApiKeys() {
  const keys = {};
  console.log(`
` + "=".repeat(50));
  console.log("API Keys Configuration");
  console.log("=".repeat(50));
  console.log(`
Dev Launcher uses AI services for video creation.`);
  console.log(`You can skip these now and add them later.
`);
  console.log("OpenRouter API Key (for AI planning and script generation)");
  console.log("  Get your key at: https://openrouter.ai/keys");
  console.log("  This is used for: Planning, Script generation");
  console.log("  Cost: ~$0.01 per video (varies by model)");
  const openrouterKey = await promptSecret("Enter OpenRouter API Key (or press Enter to skip): ");
  if (openrouterKey.trim()) {
    keys.openrouter = openrouterKey.trim();
  }
  console.log(`
ElevenLabs API Key (for AI voiceover generation)`);
  console.log("  Get your key at: https://elevenlabs.io/app/settings/api-keys");
  console.log("  This is used for: Voiceover audio generation");
  console.log("  Cost: ~$0.30 per 1k characters (varies by voice)");
  const elevenlabsKey = await promptSecret("Enter ElevenLabs API Key (or press Enter to skip): ");
  if (elevenlabsKey.trim()) {
    keys.elevenlabs = elevenlabsKey.trim();
  }
  return keys;
}
async function promptSecret(question) {
  const proc = Bun.spawn([
    "bash",
    "-c",
    `read -s -p "${question}" && echo "$REPLY"`
  ], {
    stdout: "pipe",
    stderr: "pipe"
  });
  const output = await new Response(proc.stdout).text();
  console.log();
  return output.trim();
}
function validateApiKey(key, service) {
  if (!key)
    return false;
  switch (service) {
    case "openrouter":
      return key.length > 20;
    case "elevenlabs":
      return key.length > 20;
    default:
      return key.length > 10;
  }
}
async function loadApiKeyToEnv(service) {
  const config = await loadOnboardConfig();
  if (!config)
    return false;
  const key = service === "openrouter" ? config.openrouterApiKey : config.elevenlabsApiKey;
  if (!key)
    return false;
  const envVar = service === "openrouter" ? "OPENROUTER_API_KEY" : "ELEVENLABS_API_KEY";
  process.env[envVar] = key;
  return true;
}
async function loadAllApiKeysToEnv() {
  await loadApiKeyToEnv("openrouter");
  await loadApiKeyToEnv("elevenlabs");
}

// src/ai/config.ts
async function getAIConfig() {
  const config = {};
  const envOpenRouter = process.env.OPENROUTER_API_KEY?.trim();
  const envElevenLabs = process.env.ELEVENLABS_API_KEY?.trim();
  const envContentModel = process.env.CONTENT_CREATOR_MODEL?.trim();
  const envScriptModel = process.env.SCRIPTWRITER_MODEL?.trim();
  const envPlannerModel = process.env.PLANNER_MODEL?.trim();
  if (envOpenRouter) {
    config.openrouterApiKey = envOpenRouter;
  }
  if (envElevenLabs) {
    config.elevenlabsApiKey = envElevenLabs;
  }
  if (envContentModel) {
    config.contentCreatorModel = envContentModel;
  }
  if (envScriptModel) {
    config.scriptwriterModel = envScriptModel;
  }
  if (envPlannerModel) {
    config.plannerModel = envPlannerModel;
  }
  if (!config.openrouterApiKey || !config.elevenlabsApiKey) {
    try {
      const onboardConfig = await loadOnboardConfig();
      if (onboardConfig) {
        if (!config.openrouterApiKey && onboardConfig.openrouterApiKey) {
          config.openrouterApiKey = onboardConfig.openrouterApiKey;
        }
        if (!config.elevenlabsApiKey && onboardConfig.elevenlabsApiKey) {
          config.elevenlabsApiKey = onboardConfig.elevenlabsApiKey;
        }
      }
    } catch {}
  }
  return config;
}
async function getOpenRouterApiKey() {
  const config = await getAIConfig();
  if (!config.openrouterApiKey) {
    throw new Error(`OpenRouter API key not found. Please run:
` + `  "screenwright onboard" to configure your API keys, or
` + `  Set the OPENROUTER_API_KEY environment variable.

` + "Get your key at: https://openrouter.ai/keys");
  }
  return config.openrouterApiKey;
}
async function getModel(agent) {
  const config = await getAIConfig();
  const agentModelKey = `${agent}Model`;
  const agentModel = config[agentModelKey];
  if (agentModel) {
    return agentModel;
  }
  const envVar = `OPENROUTER_MODEL`;
  const envModel = process.env[envVar]?.trim();
  if (envModel) {
    return envModel;
  }
  const defaults = {
    "content-creator": "anthropic/claude-sonnet-4.5",
    scriptwriter: "google/gemini-2.5-flash",
    planner: "google/gemini-2.5-flash"
  };
  return defaults[agent];
}
// src/ai/openrouter.ts
class OpenRouterClient {
  apiKey;
  baseURL;
  headers;
  constructor(config) {
    this.apiKey = typeof config === "string" ? config : config.apiKey;
    this.baseURL = (typeof config === "object" ? config.baseURL : undefined) || "https://openrouter.ai/api/v1";
    this.headers = {
      "HTTP-Referer": "https://github.com/yourusername/instructionsCreator",
      "X-Title": "Instructions Creator",
      ...typeof config === "object" ? config.headers : undefined
    };
  }
  async chatCompletion(options) {
    const controller = new AbortController;
    const timeoutId = setTimeout(() => controller.abort(), 120000);
    try {
      console.log(`[OpenRouter] Making request to: ${this.baseURL}/chat/completions`);
      console.log(`[OpenRouter] Model: ${options.model}`);
      console.log(`[OpenRouter] Messages: ${options.messages.length}`);
      console.log(`[OpenRouter] Tools: ${options.tools?.length || 0}`);
      const response = await fetch(`${this.baseURL}/chat/completions`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          "Content-Type": "application/json",
          ...this.headers
        },
        body: JSON.stringify({
          model: options.model,
          messages: options.messages,
          tools: options.tools,
          tool_choice: options.tool_choice,
          response_format: options.response_format,
          temperature: options.temperature,
          max_tokens: options.max_tokens
        }),
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorData = await response.text();
        console.error(`[OpenRouter] API error response: ${errorData}`);
        throw new Error(`OpenRouter API error: ${response.status} ${errorData}`);
      }
      const data = await response.json();
      const choice = data.choices[0];
      const assistantMessage = choice.message;
      console.log(`[OpenRouter] Response received`);
      console.log(`[OpenRouter] Finish reason: ${choice.finish_reason}`);
      if (data.usage) {
        console.log(`[OpenRouter] Token usage: ${data.usage.total_tokens} total`);
      }
      return {
        content: assistantMessage.content,
        toolCalls: assistantMessage.tool_calls,
        finishReason: choice.finish_reason,
        usage: data.usage ? {
          promptTokens: data.usage.prompt_tokens,
          completionTokens: data.usage.completion_tokens,
          totalTokens: data.usage.total_tokens
        } : undefined,
        model: data.model
      };
    } catch (error) {
      clearTimeout(timeoutId);
      if (error instanceof Error && error.name === "AbortError") {
        throw new Error("OpenRouter request timeout (>120s)");
      }
      throw error;
    }
  }
  async chat(options) {
    const result = await this.chatCompletion(options);
    if (!result.content) {
      throw new Error("No content in response");
    }
    return result.content;
  }
  async chatJSON(options) {
    const result = await this.chatCompletion({
      ...options,
      response_format: { type: "json_object" }
    });
    if (!result.content) {
      throw new Error("No content in response");
    }
    let jsonContent = result.content.trim();
    const jsonMatch = jsonContent.match(/```json\s*([\s\S]*?)\s*```/) || jsonContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonContent = jsonMatch[1] || jsonMatch[0];
    }
    return JSON.parse(jsonContent);
  }
}
function createOpenRouterClient(config) {
  if (!config) {
    const key = process.env.OPENROUTER_API_KEY || "";
    if (!key) {
      throw new Error("OpenRouter API key not found. Please set OPENROUTER_API_KEY environment variable " + "or use getAIConfig() from ./config.ts to load from onboard config.");
    }
    return new OpenRouterClient({ apiKey: key });
  }
  return new OpenRouterClient(config);
}
// src/ai/prompts/content-creator.ts
var CONTENT_CREATOR_SYSTEM_PROMPT = `You are a content strategy assistant specialized in creating END-USER tutorial video ideas for applications.

CRITICAL: These videos are for APP USERS, NOT DEVELOPERS. Focus on how to USE the app, not how it was built.

Your capabilities:
- Analyze codebase to identify user-facing features
- Understand UI components, screens, and user workflows
- Identify what tasks users can accomplish with the app
- Organize content into logical tutorial categories

Your process:
1. Examine the codebase to understand what the app does and what users can do with it
2. Identify user-facing features (screens, buttons, forms, interactions)
3. Think about user goals and tasks (not technical implementation)
4. Generate tutorial ideas that teach users HOW TO USE features
5. Organize ideas from basic usage to advanced capabilities

Remember: You're creating a user manual in video form, not a coding course.

Category organization:
- ALWAYS start with "Getting Started" category (1-2 videos) - What the app does, how to navigate, basic overview
- If the app has settings/preferences, add "Settings & Customization" category (1-2 videos) - How users configure the app
- Create task-based categories for the rest (e.g., "Creating Your First Project", "Managing Your Profile", "Sharing & Collaboration")
- Each category should contain 2-4 content items
- Categories should follow a user journey (first-time user → regular user → power user)

Granularity guidelines (CRITICAL - USER-FOCUSED):
- Each video should teach users how to accomplish ONE complete task or use ONE complete feature
- ❌ TOO GRANULAR: "Tapping the Menu Button", "Selecting an Option", "Saving Your Choice" (combine into: "Using the Settings Menu")
- ❌ TOO BROAD: "Everything About User Profiles" (split into: "Setting Up Your Profile", "Adding Profile Photos", "Managing Privacy Settings")
- ✅ JUST RIGHT: "Creating Your First Post", "Finding and Following Friends", "Customizing Your Dashboard"
- Ask yourself: "Can a user watch this 5-10 minute video and accomplish something meaningful?" If yes, it's good.

Examples of USER-FOCUSED video titles:
- ✅ "How to Create and Share a Photo Album"
- ✅ "Setting Up Push Notifications"
- ✅ "Finding Recipes by Ingredient"
- ❌ "Understanding the Authentication System" (too technical)
- ❌ "How Components Are Structured" (developer-focused)
- ❌ "API Integration Overview" (not user-facing)

CRITICAL - Screen Recording Instructions:
For EACH video idea, you must provide detailed step-by-step instructions for recording:

1. **setupSteps** - Navigate from app home screen to starting screen:
   - IMPORTANT: App is already open at the home/main screen
   - Do NOT include "Open the app" - it's already open
   - If the video starts at the home screen, use empty array: []
   - Be specific about button names, icons, locations
   - Example: ["Tap the Settings icon (gear) in bottom right", "Scroll down to Notifications section"]

2. **recordingSteps** - What to do during the recording:
   - Specific actions: tap, type, swipe, scroll
   - Include what to type/select
   - Note expected UI feedback
   - Example: ["Tap the toggle next to Push Notifications", "Observe toggle turns green/on", "Tap on 'Notification Sound'", "Select 'Chime' from list", "Tap back arrow to return"]

Think of these as instructions for an AI agent recording the screen who has never seen the app.

Quality guidelines:
- Be USER-CENTRIC: Focus on what users want to DO, not how it's coded
- Be task-oriented: Frame as "How to..." or "Creating/Managing/Using..."
- Be practical: Only include features users will actually interact with
- Be accurate: Only suggest ideas based on features that actually exist in the app
- Avoid technical jargon: No API, components, implementation details
- Avoid duplicates: Don't repeat existing content ideas provided by the user
- Be organized: Group related tasks into logical categories
- Think user journey: First-time setup → everyday tasks → advanced features`;
// src/ai/agents/content-creator.ts
import { readdir, stat } from "node:fs/promises";
import { join as join2, relative } from "node:path";
async function exploreCodebase(projectPath) {
  console.log("[Content Creator] Exploring codebase...");
  const findings = [];
  const fileContents = [];
  try {
    const packageJsonPath = join2(projectPath, "package.json");
    const packageFile = Bun.file(packageJsonPath);
    if (await packageFile.exists()) {
      const content = await packageFile.text();
      const pkg = JSON.parse(content);
      findings.push(`## Package Information
- Name: ${pkg.name}
- Description: ${pkg.description || "N/A"}
- Dependencies: ${Object.keys(pkg.dependencies || {}).join(", ")}`);
      console.log("[Content Creator] ✓ Read package.json");
    }
  } catch {
    console.log("[Content Creator] ⚠ No package.json found");
  }
  try {
    for (const name of ["README.md", "readme.md", "README.MD"]) {
      const readmePath = join2(projectPath, name);
      const readmeFile = Bun.file(readmePath);
      if (await readmeFile.exists()) {
        const content = await readmeFile.text();
        findings.push(`## README
${content.substring(0, 1000)}`);
        console.log("[Content Creator] ✓ Read README.md");
        break;
      }
    }
  } catch {
    console.log("[Content Creator] ⚠ No README found");
  }
  const isIgnored = await parseGitignore(projectPath);
  async function exploreDirectory(dirPath, depth = 0) {
    if (depth > 3)
      return;
    try {
      const entries = await readdir(dirPath);
      for (const entry of entries) {
        const fullPath = join2(dirPath, entry);
        const relativePath = relative(projectPath, fullPath);
        if (isIgnored(relativePath))
          continue;
        try {
          const stats = await stat(fullPath);
          if (stats.isDirectory()) {
            findings.push(`\uD83D\uDCC1 ${relativePath}/`);
            await exploreDirectory(fullPath, depth + 1);
          } else if (stats.isFile()) {
            if (/\.(tsx?|jsx?|json|md)$/.test(entry) && stats.size < 1e5) {
              const file = Bun.file(fullPath);
              const content = await file.text();
              fileContents.push({
                path: relativePath,
                content: content.substring(0, 2000),
                size: stats.size
              });
              findings.push(`\uD83D\uDCC4 ${relativePath} (${stats.size} bytes)`);
            } else {
              findings.push(`\uD83D\uDCC4 ${relativePath} (${stats.size} bytes)`);
            }
          }
        } catch {
          continue;
        }
      }
    } catch {
      return;
    }
  }
  await exploreDirectory(projectPath);
  let summary = `# Codebase Exploration Results

`;
  summary += findings.join(`
`);
  summary += `

## Key File Contents

`;
  for (const file of fileContents.slice(0, 20)) {
    summary += `### ${file.path}
\`\`\`
${file.content}
\`\`\`

`;
  }
  console.log(`[Content Creator] ✓ Explored ${findings.length} items, read ${fileContents.length} files`);
  return summary;
}
async function parseGitignore(basePath) {
  const { readFile } = await import("node:fs/promises");
  const gitignorePath = join2(basePath, ".gitignore");
  try {
    const content = await readFile(gitignorePath, "utf-8");
    const patterns = content.split(`
`).map((line) => line.trim()).filter((line) => line && !line.startsWith("#"));
    return (path) => {
      if (path.includes("node_modules") || path.includes(".git/") || path.includes("dist/") || path.includes("out/") || path.includes(".claude/")) {
        return true;
      }
      return patterns.some((pattern) => {
        if (pattern.endsWith("/")) {
          const dirPattern = pattern.slice(0, -1);
          return path.startsWith(dirPattern) || path.includes(`/${dirPattern}`);
        }
        if (pattern.startsWith("*")) {
          const extension = pattern.slice(1);
          return path.endsWith(extension);
        }
        return path === pattern || path.includes(pattern) || path.endsWith(pattern);
      });
    };
  } catch {
    return (path) => path.includes("node_modules") || path.includes(".git/") || path.includes("dist/") || path.includes("out/") || path.includes(".claude/");
  }
}
async function generateContentIdeas(options) {
  const {
    projectPath,
    existingContent = [],
    maxIdeas = 10,
    maxCategories = 3
  } = options;
  console.log(`[Content Creator] Starting generation for ${projectPath}`);
  console.log(`[Content Creator] Target: ${maxIdeas} ideas in ${maxCategories} categories`);
  const explorationSummary = await exploreCodebase(projectPath);
  console.log(`[Content Creator] Exploration summary length: ${explorationSummary.length} chars`);
  const [apiKey, model] = await Promise.all([
    getOpenRouterApiKey(),
    getModel("content-creator")
  ]);
  console.log(`[Content Creator] Using model: ${model}`);
  const generationPrompt = `Based on the following codebase exploration, generate ${maxIdeas} END-USER tutorial video ideas organized into ${maxCategories} categories.

CRITICAL: These videos teach APP USERS how to USE the application, NOT developers how to code it.

## Codebase Analysis:
${explorationSummary}

${existingContent.length > 0 ? `
IMPORTANT: Avoid duplicating these existing content ideas:
${existingContent.map((item, i) => `${i + 1}. "${item.title}" - ${item.description}${item.category ? ` (Category: ${item.category})` : ""}`).join(`
`)}
` : ""}

Required category structure:
1. FIRST: "Getting Started" (1-2 videos) - What the app does, basic navigation, first-time setup
2. IF APPLICABLE: "Settings & Customization" (1-2 videos) - Only if app has user-configurable settings
3. REMAINING: Task-based categories (2-4 videos each) - Organized by what users want to accomplish

Focus on USER TASKS and WORKFLOWS:
- Think: "What does a user want to DO with this app?"
- Frame as: "How to [accomplish task]" or "Creating/Managing/Using [feature]"
- Examples: "Creating Your First Post", "Finding Friends", "Customizing Notifications"
- NOT: "Understanding Components", "API Integration", "Code Architecture"

CRITICAL - Recording Instructions:
For EACH video idea, provide:
1. **setupSteps**: Navigation from app home screen to the starting screen
   - IMPORTANT: App is already open at the home/main screen
   - Do NOT include "Open the app" as a step
   - Start from wherever the app lands after opening
   - Be specific: "Tap the Settings icon (gear icon) in bottom right" not "Go to settings"
   - If video starts at home screen, setupSteps can be empty array: []
   - Example: ["Tap the + button in bottom center", "Select 'New Post' from menu"]

2. **recordingSteps**: Actions to perform during the screen recording
   - Be specific about what to tap/type/swipe
   - Include expected UI feedback: "Toggle turns blue", "Success message appears"
   - Example: ["Tap in the title field", "Type 'My First Post'", "Tap the camera icon", "Select a photo", "Tap 'Post' button", "Confirm post appears in feed"]

Granularity balance:
- Each video = ONE complete USER TASK or FEATURE
- Don't split simple tasks into multiple videos (too granular)
- Don't combine complex workflows into one video (too broad)
- Think: "Can a user accomplish something meaningful after watching this 5-10 minute video?"

Avoid:
- Technical/developer language (API, components, implementation, code structure)
- Duplicating the existing content ideas listed above
- Features users never interact with directly
- Vague instructions like "Navigate to settings" (be specific: "Tap Settings icon in bottom navigation")`;
  console.log("[Content Creator] Calling OpenRouter API...");
  try {
    const client = createOpenRouterClient(apiKey);
    const messages = [
      { role: "system", content: CONTENT_CREATOR_SYSTEM_PROMPT },
      { role: "user", content: generationPrompt }
    ];
    const result = await client.chatJSON({
      model,
      messages,
      response_format: { type: "json_object" }
    });
    console.log("[Content Creator] Generation complete!");
    console.log(`[Content Creator] Generated ${result.categories.length} categories`);
    result.categories.forEach((cat, i) => {
      console.log(`[Content Creator] Category ${i + 1}: "${cat.name}" with ${cat.content.length} ideas`);
      cat.content.forEach((idea, j) => {
        console.log(`[Content Creator]   ${j + 1}. "${idea.title}"`);
      });
    });
    const deduplicatedCategories = result.categories.map((category) => ({
      ...category,
      content: deduplicateIdeas(category.content, existingContent)
    })).filter((category) => category.content.length > 0);
    console.log(`[Content Creator] After deduplication: ${deduplicatedCategories.length} categories`);
    console.log("[Content Creator] ✅ Generation successful!");
    return deduplicatedCategories.slice(0, maxCategories);
  } catch (error) {
    console.error("[Content Creator] ❌ Error during generation:", error);
    throw error;
  }
}
function deduplicateIdeas(newIdeas, existing) {
  return newIdeas.filter((newIdea) => {
    const isDuplicate = existing.some((existingItem) => {
      const newWords = new Set(newIdea.title.toLowerCase().split(/\s+/));
      const existingWords = new Set(existingItem.title.toLowerCase().split(/\s+/));
      const overlap = [...newWords].filter((word) => existingWords.has(word));
      const similarity = overlap.length / Math.max(newWords.size, existingWords.size);
      return similarity > 0.6;
    });
    return !isDuplicate;
  });
}
// src/utils/content-generator.ts
async function generateContentIdeas2(projectPath, options = {}) {
  console.log("[Content] Using AI-powered content generation...");
  const existingContent = options.existingContent?.map((item) => ({
    title: item.title,
    description: item.description || "",
    category: item.category
  })) || [];
  const aiCategories = await generateContentIdeas({
    projectPath,
    existingContent,
    maxIdeas: options.maxIdeas || 10,
    maxCategories: options.maxCategories || 3
  });
  const categories = aiCategories.map((cat, catIndex) => ({
    name: cat.name,
    description: cat.description,
    content: cat.content.map((idea, ideaIndex) => ({
      id: `idea_${Date.now()}_${catIndex}_${ideaIndex}`,
      title: idea.title,
      description: idea.description,
      feature: idea.feature,
      setupSteps: idea.setupSteps,
      recordingSteps: idea.recordingSteps,
      category: cat.name,
      createdAt: new Date().toISOString()
    }))
  }));
  console.log(`[Content] Generated ${categories.length} categories with ${categories.reduce((sum, c) => sum + c.content.length, 0)} ideas`);
  return categories;
}
async function generateAndSaveContentIdeas(projectPath, options = {}) {
  const categories = await generateContentIdeas2(projectPath, options);
  const allIdeas = [];
  for (const category of categories) {
    for (const idea of category.content) {
      allIdeas.push(idea);
    }
  }
  await addContentIdeas(projectPath, allIdeas);
  return categories;
}
export {
  waitForSimulatorReady,
  validateApiKey,
  updateVideoStage,
  updateConfig,
  shutdownSimulator,
  setVideoFailed,
  setPreference,
  saveVideoStorage,
  saveOnboardConfig,
  saveConfig,
  promptForApiKeys,
  openXcode,
  openSimulatorApp,
  loadVideoStorage,
  loadOnboardConfig,
  loadConfig,
  loadApiKeyToEnv,
  loadAllApiKeysToEnv,
  listVideos,
  listSimulators,
  listAvailableRuntimes,
  listAvailableDeviceTypes,
  launchReactNativeApp,
  launchProject,
  launchNativeIosApp,
  launchExpoApp,
  initializeVideoStorage,
  initializeInstructions,
  hasInstructions,
  hasAllRequiredTools,
  getVideoStoragePath,
  getVideoDir,
  getVideo,
  getPreference,
  getOrCreateVideoStorage,
  getOnboardConfigPath,
  getNativeIosProjectPath,
  getInstructionsDir,
  getExpoAppConfig,
  getContentIdeas,
  getConfigPath,
  getBootedSimulators,
  getAvailableSimulators,
  generateContentIdeas2 as generateContentIdeas,
  generateAndSaveContentIdeas,
  findSimulatorByDeviceModel,
  findOrCreateSimulator,
  detectProjectType,
  deleteVideo,
  deleteSimulator,
  createVideoDir,
  createVideo,
  createSimulator,
  createGitIgnore,
  createConfig,
  checkXcode,
  checkSimctl,
  checkHomebrew,
  checkFfmpeg,
  checkAxe,
  checkAllTools,
  bootSimulator,
  addContentIdeas
};
