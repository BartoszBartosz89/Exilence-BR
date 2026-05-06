const path = require('path');
const { spawn } = require('child_process');

const electronPath = require('electron');
const repoRoot = path.resolve(__dirname, '..');

const child = spawn(electronPath, [repoRoot], {
  stdio: 'inherit',
  windowsHide: false,
});

child.on('close', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
    return;
  }

  process.exit(code || 0);
});

const forwardSignal = (signal) => {
  process.on(signal, () => {
    if (!child.killed) {
      child.kill(signal);
    }
  });
};

forwardSignal('SIGINT');
forwardSignal('SIGTERM');
