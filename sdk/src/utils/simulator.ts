/**
 * iOS Simulator management utilities
 */

import type { SimulatorInfo } from '../types.js';

/**
 * List all available iOS simulators
 */
export async function listSimulators(): Promise<SimulatorInfo[]> {
  const proc = Bun.spawn(['xcrun', 'simctl', 'list', 'devices', '-j'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error('Failed to list simulators. Make sure Xcode is installed.');
  }

  const output = await new Response(proc.stdout).text();
  const data = JSON.parse(output);

  const simulators: SimulatorInfo[] = [];

  for (const runtime in data.devices) {
    const devices = data.devices[runtime];
    for (const device of devices) {
      simulators.push({
        udid: device.udid,
        name: device.name,
        deviceType: device.deviceTypeIdentifier || 'unknown',
        runtime: runtime,
        state: device.state,
      });
    }
  }

  return simulators;
}

/**
 * Get booted simulators
 */
export async function getBootedSimulators(): Promise<SimulatorInfo[]> {
  const allSimulators = await listSimulators();
  return allSimulators.filter(sim => sim.state === 'Booted');
}

/**
 * Get available (shutdown) simulators
 */
export async function getAvailableSimulators(): Promise<SimulatorInfo[]> {
  const allSimulators = await listSimulators();
  return allSimulators.filter(sim => sim.state === 'Shutdown');
}

/**
 * Boot a simulator
 */
export async function bootSimulator(udid: string): Promise<void> {
  const proc = Bun.spawn(['xcrun', 'simctl', 'boot', udid], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await proc.exited;

  // Check if already booted
  if (proc.exitCode !== 0) {
    const booted = await getBootedSimulators();
    if (booted.some(s => s.udid === udid)) {
      return; // Already booted
    }
    throw new Error(`Failed to boot simulator: ${udid}`);
  }
}

/**
 * Shutdown a simulator
 */
export async function shutdownSimulator(udid: string): Promise<void> {
  const proc = Bun.spawn(['xcrun', 'simctl', 'shutdown', udid], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await proc.exited;
}

/**
 * Create a new simulator
 */
export async function createSimulator(
  name: string,
  deviceType: string,
  runtime: string
): Promise<string> {
  const proc = Bun.spawn([
    'xcrun',
    'simctl',
    'create',
    name,
    deviceType,
    runtime
  ], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    const error = await new Response(proc.stderr).text();
    throw new Error(`Failed to create simulator: ${error}`);
  }

  const output = await new Response(proc.stdout).text();
  return output.trim();
}

/**
 * Delete a simulator
 */
export async function deleteSimulator(udid: string): Promise<void> {
  const proc = Bun.spawn(['xcrun', 'simctl', 'delete', udid], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error('Failed to delete simulator');
  }
}

/**
 * Get available device types
 */
export async function listAvailableDeviceTypes(): Promise<string[]> {
  const proc = Bun.spawn(['xcrun', 'simctl', 'list', 'devicetypes'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await proc.exited;

  const output = await new Response(proc.stdout).text();

  return output
    .split('\n')
    .filter(line => line.includes('com.apple.CoreSimulator.SimDeviceType'))
    .map(line => {
      const match = line.match(/\(([^)]+)\)/);
      return match ? match[1] : null;
    })
    .filter(Boolean) as string[];
}

/**
 * Get available runtimes
 */
export async function listAvailableRuntimes(): Promise<string[]> {
  const proc = Bun.spawn(['xcrun', 'simctl', 'list', 'runtimes'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await proc.exited;

  const output = await new Response(proc.stdout).text();

  const runtimes = output
    .split('\n')
    .filter(line => line.includes('com.apple.CoreSimulator.SimRuntime.iOS'))
    .map(line => {
      const match = line.match(/com\.apple\.CoreSimulator\.SimRuntime\.iOS-[\d-]+/);
      return match ? match[0] : null;
    })
    .filter(Boolean) as string[];

  return Array.from(new Set(runtimes));
}

/**
 * Find a simulator by device model (e.g., "iPhone 15 Pro")
 */
export async function findSimulatorByDeviceModel(deviceModel: string): Promise<SimulatorInfo | null> {
  const simulators = await listSimulators();
  return simulators.find(sim =>
    sim.name.toLowerCase().includes(deviceModel.toLowerCase())
  ) || null;
}

/**
 * Find or create a simulator for a given device model
 */
export async function findOrCreateSimulator(deviceModel: string = 'iPhone 15 Pro'): Promise<SimulatorInfo> {
  // First try to find an existing simulator
  const existing = await findSimulatorByDeviceModel(deviceModel);
  if (existing) {
    return existing;
  }

  // Create a new simulator
  const deviceTypes = await listAvailableDeviceTypes();
  const runtimes = await listAvailableRuntimes();

  const deviceType = deviceTypes.find(dt =>
    dt.toLowerCase().includes(deviceModel.toLowerCase().replace(/\s+/g, '-'))
  );

  if (!deviceType) {
    throw new Error(`Device type "${deviceModel}" not found`);
  }

  const runtime = runtimes[runtimes.length - 1]; // Use latest runtime
  const simulatorName = `${deviceModel.replace(/\s+/g, '-')}-${Date.now()}`;
  const udid = await createSimulator(simulatorName, deviceType, runtime);

  return {
    udid,
    name: simulatorName,
    deviceType,
    runtime,
    state: 'Shutdown',
  };
}

/**
 * Wait for simulator to be ready
 */
export async function waitForSimulatorReady(udid: string, timeoutMs: number = 120000): Promise<void> {
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const simulators = await listSimulators();
    const simulator = simulators.find(s => s.udid === udid);

    if (simulator?.state === 'Booted') {
      // Check boot status
      const statusProc = Bun.spawn(['xcrun', 'simctl', 'bootstatus', udid, '-b'], {
        stdout: 'pipe',
        stderr: 'pipe',
      });

      await statusProc.exited;

      if (statusProc.exitCode === 0) {
        return;
      }
    }

    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  throw new Error(`Simulator failed to be ready within ${timeoutMs}ms`);
}

/**
 * Open Xcode Simulator app
 */
export async function openSimulatorApp(): Promise<void> {
  const proc = Bun.spawn(['open', '-a', 'Simulator'], {
    stdout: 'pipe',
    stderr: 'pipe',
  });

  await proc.exited;

  if (proc.exitCode !== 0) {
    throw new Error('Failed to open Simulator app');
  }
}

/**
 * Open Xcode
 */
export async function openXcode(projectPath?: string): Promise<void> {
  if (projectPath) {
    // Try to find and open .xcworkspace or .xcodeproj
    const workspaceProc = Bun.spawn(['find', projectPath, '-name', '*.xcworkspace', '-maxdepth', '3'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await workspaceProc.exited;

    if (workspaceProc.exitCode === 0) {
      const output = await new Response(workspaceProc.stdout).text();
      const workspacePath = output.trim().split('\n')[0];
      if (workspacePath) {
        Bun.spawn(['open', workspacePath]);
        return;
      }
    }

    // Fall back to .xcodeproj
    const projectProc = Bun.spawn(['find', projectPath, '-name', '*.xcodeproj', '-maxdepth', '3'], {
      stdout: 'pipe',
      stderr: 'pipe',
    });

    await projectProc.exited;

    if (projectProc.exitCode === 0) {
      const output = await new Response(projectProc.stdout).text();
      const projectPathStr = output.trim().split('\n')[0];
      if (projectPathStr) {
        Bun.spawn(['open', projectPathStr]);
        return;
      }
    }
  }

  // Just open Xcode app
  Bun.spawn(['open', '-a', 'Xcode']);
}
