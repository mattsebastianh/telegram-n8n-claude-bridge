// node-pty 1.1.0 ships its macOS prebuilt spawn-helper without the execute
// bit, so pty.spawn() fails with "posix_spawnp failed". Set it after install.
const fs = require('fs');
const path = require('path');

const prebuilds = path.join(__dirname, '..', 'node_modules', 'node-pty', 'prebuilds');
if (fs.existsSync(prebuilds)) {
  for (const arch of fs.readdirSync(prebuilds)) {
    const helper = path.join(prebuilds, arch, 'spawn-helper');
    if (fs.existsSync(helper)) fs.chmodSync(helper, 0o755);
  }
}
