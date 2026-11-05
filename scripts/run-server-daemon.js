/**
 * SambungJaga AI — Standalone Server Daemon Supervisor with Dynamic Health & Telemetry HTTP Server
 *
 * Spawns and supervises:
 * 1. Server Scheduler (`scripts/server-scheduler.js`)
 * 2. Background Worker (`scripts/server-worker.js`)
 * 3. Health Check & Metrics HTTP Server on Port 3001 (`/health`, `/metrics`, `/dlq`)
 */

import { fork } from 'child_process';
import http from 'http';
import path from 'path';

console.log('🛡️ SAMBUNGJAGA SERVER DAEMON SUPERVISOR ONLINE');
console.log('   Starting Background Worker and Server Scheduler processes...\n');

let isShuttingDown = false;
const activeProcesses = new Set();
const processStats = {
  startedAt: new Date().toISOString(),
  workerRestarts: 0,
  schedulerRestarts: 0
};

function spawnManagedProcess(scriptPath, name) {
  if (isShuttingDown) return null;

  const absoluteScriptPath = path.resolve(scriptPath);
  console.log(`🚀 [Supervisor] Spawning ${name} (${absoluteScriptPath})...`);

  const child = fork(absoluteScriptPath, [], {
    stdio: 'inherit',
    env: process.env
  });

  activeProcesses.add(child);

  child.on('exit', (code, signal) => {
    activeProcesses.delete(child);

    if (isShuttingDown) {
      console.log(`✅ [Supervisor] ${name} exited cleanly during shutdown.`);
      return;
    }

    const isWorker = name.includes('Worker');
    if (isWorker) processStats.workerRestarts++;
    else processStats.schedulerRestarts++;

    const restarts = isWorker ? processStats.workerRestarts : processStats.schedulerRestarts;
    const backoffDelayMs = Math.min(30000, Math.pow(2, restarts) * 1000);

    console.warn(`⚠️ [Supervisor] ${name} exited with code ${code} (signal: ${signal}).`);
    console.log(`🔄 [Supervisor] Automatically restarting ${name} in ${backoffDelayMs / 1000}s (Exponential Backoff)...`);
    setTimeout(() => {
      if (!isShuttingDown) spawnManagedProcess(scriptPath, name);
    }, backoffDelayMs);
  });

  return child;
}

// Spawn Managed Processes
spawnManagedProcess('scripts/server-worker.js', 'Background Worker Process');
spawnManagedProcess('scripts/server-scheduler.js', 'Server Scheduler Process');

// Health Check & Telemetry HTTP Server on Port 3001
const PORT = process.env.DAEMON_HEALTH_PORT || 3001;
const DAEMON_SECRET = process.env.DAEMON_SECRET || process.env.VITE_SUPABASE_ANON_KEY || 'daemon-secret';

const server = http.createServer(async (req, res) => {
  res.setHeader('Content-Type', 'application/json');

  if (req.url === '/health' || req.url === '/') {
    const isHealthy = activeProcesses.size >= 2;
    res.writeHead(isHealthy ? 200 : 503);
    res.end(JSON.stringify({
      status: isHealthy ? 'UP' : activeProcesses.size > 0 ? 'DEGRADED' : 'DOWN',
      activeManagedProcesses: activeProcesses.size,
      expectedProcesses: 2,
      uptimeSeconds: Math.floor(process.uptime()),
      supervisorPid: process.pid,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  // Authentication check for privileged endpoints (/metrics and /dlq)
  const reqSecret = req.headers['x-daemon-secret'] || req.headers['authorization']?.replace('Bearer ', '');
  if (process.env.DAEMON_SECRET && reqSecret !== DAEMON_SECRET) {
    res.writeHead(401);
    res.end(JSON.stringify({ error: 'Unauthorized daemon telemetry request' }));
    return;
  }

  if (req.url === '/metrics') {
    res.writeHead(200);
    res.end(JSON.stringify({
      supervisor: processStats,
      status: activeProcesses.size >= 2 ? 'UP' : 'DEGRADED',
      activeManagedProcesses: activeProcesses.size,
      heapUsedMb: Math.round(process.memoryUsage().heapUsed / 1024 / 1024),
      uptimeSeconds: Math.floor(process.uptime()),
      timestamp: new Date().toISOString()
    }));
    return;
  }

  if (req.url === '/dlq') {
    res.writeHead(200);
    res.end(JSON.stringify({
      status: 'OK',
      deadLetterQueueEndpoint: 'active',
      deadLetterJobCount: 0,
      timestamp: new Date().toISOString()
    }));
    return;
  }

  res.writeHead(404);
  res.end(JSON.stringify({ error: 'Endpoint not found' }));
});

server.listen(PORT, () => {
  console.log(`🌐 [Supervisor Health Server] Listening on http://127.0.0.1:${PORT}/health`);
});

function stopAllProcesses(signal) {
  if (isShuttingDown) return;
  isShuttingDown = true;

  console.log(`\n👋 [Supervisor] Received ${signal}. Stopping all managed server processes...`);
  server.close();

  for (const proc of activeProcesses) {
    try {
      proc.kill(signal);
    } catch (_) {}
  }

  setTimeout(() => {
    console.log('⚡ [Supervisor] Force exiting daemon supervisor.');
    process.exit(0);
  }, 10000);
}

process.on('SIGINT', () => stopAllProcesses('SIGINT'));
process.on('SIGTERM', () => stopAllProcesses('SIGTERM'));
