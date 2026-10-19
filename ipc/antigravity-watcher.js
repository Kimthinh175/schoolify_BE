const fs = require('fs');
const path = require('path');

const INBOX_DIR = '/home/thinh/ca-nhan/schoolify/BE/ipc/inbox';
const OUTBOX_DIR = '/home/thinh/ca-nhan/schoolify/BE/ipc/outbox';

fs.mkdirSync(INBOX_DIR, { recursive: true });
fs.mkdirSync(OUTBOX_DIR, { recursive: true });

console.log('[Antigravity Live Bridge] Listening for incoming Backend AI jobs in', INBOX_DIR);

const checkInbox = () => {
  try {
    const files = fs
      .readdirSync(INBOX_DIR)
      .filter((f) => f.endsWith('.json') && !f.endsWith('.claimed.json'))
      .sort();

    for (const file of files) {
      const fullPath = path.join(INBOX_DIR, file);
      const claimedPath = path.join(INBOX_DIR, file.replace(/\.json$/, '.claimed.json'));
      try {
        fs.renameSync(fullPath, claimedPath);
      } catch {
        continue;
      }

      const content = fs.readFileSync(claimedPath, 'utf-8');
      console.log('=== ANTIGRAVITY_IPC_JOB_START ===');
      console.log(content);
      console.log('=== ANTIGRAVITY_IPC_JOB_END ===');
      process.exit(0);
    }
  } catch (err) {
    // ignore transient fs errors
  }
};

checkInbox();
setInterval(checkInbox, 200);
