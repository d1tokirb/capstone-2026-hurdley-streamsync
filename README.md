# StreamSync

Synchronize video playback with friends.

## Structure

- `extension/`: Chrome Extension (Manifest V3). Load this directory as an unpacked extension.
- `server/`: Node.js Signaling Server. Run `npm start` here.

## Quick Start

1. **Start Server**:
   ```bash
   cd server
   npm install
   npm start
   ```

2. **Load Extension**:
   - Go to `chrome://extensions/`
   - Enable Developer Mode
   - Load Unpacked -> Select `extension/` folder.

3. **Sync**:
   - Open a video.
   - Click the extension icon / open Side Panel.
   - Enter a Room ID.
   - Share Room ID with friends.
# capstone-2026-hurdley-streamsync
