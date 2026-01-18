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
// src/utils/content-generator.ts
async function generateContentIdeas(projectPath, options = {}) {
  console.log("[Content] Analyzing project for content ideas...");
  const projectType = await detectProjectType(projectPath);
  const maxIdeas = options.maxIdeas || 10;
  const maxCategories = options.maxCategories || 3;
  let packageName = "app";
  let packageDescription = "";
  try {
    const packageJsonPath = `${projectPath}/package.json`;
    const packageJson = await Bun.file(packageJsonPath).json();
    packageName = packageJson.name || "app";
    packageDescription = packageJson.description || "";
  } catch {}
  let appName = packageName;
  try {
    const appJsonPath = `${projectPath}/app.json`;
    const appJson = await Bun.file(appJsonPath).json();
    appName = appJson.name || appJson.expo?.name || appName;
  } catch {}
  console.log(`[Content] Project: ${appName} (${projectType})`);
  const analysis = await analyzeProjectStructure(projectPath, projectType);
  console.log(`[Content] Found ${analysis.features.length} features, ${analysis.screens.length} screens`);
  const categories = generateCategoriesForProject(appName, projectType, analysis, maxIdeas, maxCategories);
  console.log(`[Content] Generated ${categories.length} categories with ${categories.reduce((sum, c) => sum + c.content.length, 0)} ideas`);
  return categories;
}
async function analyzeProjectStructure(projectPath, projectType) {
  const features = [];
  const screens = [];
  const patterns = {
    features: [
      "auth",
      "login",
      "signup",
      "profile",
      "settings",
      "notification",
      "chat",
      "message",
      "post",
      "feed",
      "search",
      "filter",
      "camera",
      "photo",
      "video",
      "upload",
      "download",
      "map",
      "location",
      "navigation",
      "route",
      "payment",
      "checkout",
      "cart",
      "order",
      "social",
      "friend",
      "follow",
      "like",
      "comment",
      "dashboard",
      "analytics",
      "report",
      "chart",
      "todo",
      "task",
      "reminder",
      "calendar",
      "event"
    ],
    screens: [
      "home",
      "main",
      "landing",
      "splash",
      "welcome",
      "detail",
      "list",
      "grid",
      "form",
      "modal",
      "drawer",
      "tab",
      "stack"
    ]
  };
  try {
    const findProc = Bun.spawn([
      "find",
      projectPath,
      "-type",
      "f",
      "-name",
      "*.tsx",
      "-o",
      "-name",
      "*.ts",
      "-o",
      "-name",
      "*.jsx",
      "-o",
      "-name",
      "*.js",
      "-o",
      "-name",
      "*.swift",
      "-o",
      "-name",
      "*.m"
    ], {
      stdout: "pipe",
      stderr: "pipe"
    });
    await findProc.exited;
    if (findProc.exitCode === 0) {
      const files = await new Response(findProc.stdout).text();
      const fileList = files.trim().split(`
`).filter((f) => f && !f.includes("node_modules"));
      const sampleSize = Math.min(fileList.length, 20);
      const sample = fileList.slice(0, sampleSize);
      for (const file of sample) {
        try {
          const content = await Bun.file(file).text();
          const lowerContent = content.toLowerCase();
          for (const feature of patterns.features) {
            if (lowerContent.includes(feature) && !features.includes(feature)) {
              features.push(feature);
            }
          }
          for (const screen of patterns.screens) {
            if (lowerContent.includes(screen) && !screens.includes(screen)) {
              screens.push(screen);
            }
          }
        } catch {}
      }
    }
  } catch {}
  return { features, screens };
}
function generateCategoriesForProject(appName, projectType, analysis, maxIdeas, maxCategories) {
  const categories = [];
  const gettingStarted = {
    name: "Getting Started",
    description: `Learn the basics of using ${appName}`,
    content: [
      {
        id: `idea_${Date.now()}_1`,
        title: `Getting Started with ${appName}`,
        description: `A quick introduction to ${appName} and its main features. Learn how to navigate the app and understand its core functionality.`,
        feature: "onboarding",
        setupSteps: [],
        recordingSteps: [
          `Open ${appName} to see the home screen`,
          `Notice the main navigation elements at the bottom`,
          `Tap through different sections to explore`,
          `Observe the clean layout and intuitive design`
        ],
        category: "Getting Started",
        createdAt: new Date().toISOString()
      }
    ]
  };
  if (analysis.features.includes("auth") || analysis.features.includes("login")) {
    gettingStarted.content.push({
      id: `idea_${Date.now()}_2`,
      title: "Creating Your Account",
      description: "Learn how to sign up for a new account and complete your profile setup.",
      feature: "authentication",
      setupSteps: [],
      recordingSteps: [
        'Tap the "Sign Up" or "Get Started" button',
        "Enter your email address and create a password",
        "Fill in your profile information",
        "Verify your email if required",
        "See your personalized dashboard"
      ],
      category: "Getting Started",
      createdAt: new Date().toISOString()
    });
  }
  categories.push(gettingStarted);
  if (analysis.features.length > 0) {
    const coreFeatures = {
      name: "Core Features",
      description: `Learn how to use ${appName}'s main features`,
      content: []
    };
    const topFeatures = analysis.features.slice(0, 4);
    let ideaCount = gettingStarted.content.length;
    for (const feature of topFeatures) {
      if (ideaCount >= maxIdeas)
        break;
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
  if (analysis.features.includes("settings") || analysis.features.includes("profile")) {
    const settings = {
      name: "Settings & Customization",
      description: "Customize your experience and manage your preferences",
      content: []
    };
    if (analysis.features.includes("profile")) {
      settings.content.push({
        id: `idea_${Date.now()}_${categories.length + 1}`,
        title: "Managing Your Profile",
        description: "Learn how to update your profile information, change your avatar, and manage your account settings.",
        feature: "profile",
        setupSteps: [
          "Open the app and tap on your profile icon",
          'Select "Edit Profile" from the menu'
        ],
        recordingSteps: [
          "Update your display name",
          "Change your profile picture",
          "Add a bio or description",
          "Save your changes",
          "Verify the updates are reflected"
        ],
        category: "Settings & Customization",
        createdAt: new Date().toISOString()
      });
    }
    if (analysis.features.includes("settings")) {
      settings.content.push({
        id: `idea_${Date.now()}_${categories.length + 2}`,
        title: "Configuring App Settings",
        description: "Learn how to customize app notifications, privacy settings, and other preferences.",
        feature: "settings",
        setupSteps: [
          "Tap the Settings icon in the navigation",
          "Browse through available settings"
        ],
        recordingSteps: [
          "Toggle notifications on or off",
          "Adjust notification preferences",
          "Configure privacy settings",
          "Test theme options if available",
          "Save your preferences"
        ],
        category: "Settings & Customization",
        createdAt: new Date().toISOString()
      });
    }
    if (settings.content.length > 0) {
      categories.push(settings);
    }
  }
  return categories.slice(0, maxCategories);
}
function createFeatureIdea(feature, appName, index) {
  const featureName = feature.charAt(0).toUpperCase() + feature.slice(1);
  const featureTemplates = {
    post: {
      title: "Creating a Post",
      description: `Learn how to create and share posts on ${appName}.`,
      recordingSteps: [
        "Tap the create or post button (usually + icon)",
        "Add text content",
        "Attach photos or media if desired",
        "Add tags or location if available",
        'Tap "Post" or "Share" to publish',
        "See your post in the feed"
      ]
    },
    search: {
      title: "Searching for Content",
      description: `Learn how to search and find content on ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        "Tap the search icon or bar",
        "Type a search term",
        "See suggested results as you type",
        "Tap on a result to view",
        "Use filters if available"
      ]
    },
    chat: {
      title: "Sending Messages",
      description: `Learn how to send messages and chat on ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        "Tap on a conversation or the new message icon",
        "Type your message in the text field",
        "Tap send to deliver the message",
        "See the message appear in the conversation"
      ]
    },
    notification: {
      title: "Managing Notifications",
      description: `Learn how to view and manage your notifications on ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        "Tap the notifications bell icon",
        "View your recent notifications",
        "Tap on a notification to open it",
        "Swipe left on a notification to dismiss",
        'Tap "Mark all as read" if available'
      ]
    },
    camera: {
      title: "Taking Photos",
      description: `Learn how to take and share photos using ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        "Tap the camera icon",
        "Grant camera permissions if asked",
        "Frame your shot in the viewfinder",
        "Tap the shutter button to capture",
        "Review your photo",
        "Add effects or filters if available",
        "Share or save the photo"
      ]
    },
    profile: {
      title: "Viewing Profiles",
      description: `Learn how to view user profiles on ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        "Search for a user or tap on a username",
        "View their profile information",
        "See their posts or activity",
        "Follow or connect if available"
      ]
    },
    map: {
      title: "Using the Map",
      description: `Learn how to use the map features in ${appName}.`,
      setupSteps: [],
      recordingSteps: [
        "Navigate to the map section",
        "Grant location permissions if asked",
        "See your current location on the map",
        "Search for a place",
        "Get directions to a location"
      ]
    }
  };
  const template = featureTemplates[feature];
  if (!template) {
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
      category: "Core Features",
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
    category: "Core Features",
    createdAt: new Date().toISOString()
  };
}
async function generateAndSaveContentIdeas(projectPath, options = {}) {
  const categories = await generateContentIdeas(projectPath, options);
  const allIdeas = [];
  for (const category of categories) {
    for (const idea of category.content) {
      allIdeas.push(idea);
    }
  }
  await addContentIdeas(projectPath, allIdeas);
  return categories;
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
  generateContentIdeas,
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
