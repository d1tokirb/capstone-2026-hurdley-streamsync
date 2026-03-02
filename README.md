# 🎬 StreamSync

**Watch videos together, perfectly in sync.** StreamSync is a Chrome extension that synchronizes video playback across multiple browsers in real-time — so you and your friends can watch movies, shows, and anime together no matter where you are.

> No more counting down "3… 2… 1… play." Just press play.

## ✨ Features

- **Real-Time Video Sync** — Play, pause, and seek are instantly mirrored across all users in the room.
- **Universal Compatibility** — Works on YouTube, Crunchyroll, and any website with an HTML5 video player.
- **Built-in Chat** — Talk with your friends without leaving the browser.
- **Room System** — Create or join rooms with simple Room IDs. Share the code and you're watching together.
- **Host Controls** — The room creator is the Host. Only the Host can change the video URL for everyone.
- **Ad-Aware Syncing** — Automatically detects YouTube ads, pauses sync for the room, and resumes when the ad ends.
- **Customizable Settings** — Light/Dark theme, accent colors, chat text size, audio alerts, and Do Not Disturb mode.
- **Room Settings (Host)** — Adjust sync sensitivity, enable Strict Mode (host-only playback control), and toggle auto-pause on buffering.
- **Firebase Authentication** — Secure login via Email/Password or Google Sign-In, with email verification.
- **Username System** — Choose a display name with a 3-day change cooldown enforced via Firestore.

## 🏗️ Architecture

StreamSync uses a **client-server model** powered by WebSockets:

```
Browser Extension (Client)  ←→  Node.js + Socket.io (Server)  ←→  Other Clients
         ↕
   Firebase (Auth + Firestore)
```

| Component | Technology |
|---|---|
| Extension | Chrome Manifest V3, Side Panel API |
| Real-time Sync | Socket.io (WebSockets) |
| Server | Node.js + Express |
| Authentication | Firebase Auth (Email + Google) |
| Rate Limiting | Cloud Firestore |
| Styling | Vanilla CSS with CSS Variables (Theming Engine) |

## 📁 Project Structure

```
stream-sync/
├── extension/          # Chrome Extension (load as unpacked)
│   ├── manifest.json   # MV3 manifest
│   ├── sidepanel.html  # Main UI
│   ├── sidepanel.js    # UI logic, Socket.io client, settings
│   ├── content.js      # Video detection, sync enforcement, ad handling
│   ├── background.js   # Service worker
│   ├── auth.js         # Firebase auth + username logic
│   ├── firebase-config.js
│   ├── style.css       # Full design system with theming
│   └── lib/            # Local Firebase SDKs (MV3 compatible)
└── server/
    ├── server.js       # Express + Socket.io signaling server
    └── package.json
```

## 🚀 Quick Start

### 1. Start the Server
```bash
cd server
npm install
npm start
```
The server runs on `http://localhost:3000` by default.

### 2. Load the Extension
1. Open `chrome://extensions/`
2. Enable **Developer Mode** (top right)
3. Click **Load Unpacked** → Select the `extension/` folder

### 3. Watch Together
1. Open any video in your browser
2. Click the StreamSync icon to open the Side Panel
3. Sign in or create an account
4. Enter a **Room ID** and click **Join Room**
5. Share the Room ID with your friends — that's it!

## ⚙️ Configuration

### Firebase Setup
You'll need your own Firebase project. Update `extension/firebase-config.js` with your credentials:
- Enable **Email/Password** and **Google** sign-in providers in Firebase Console
- Add your Chrome extension ID to authorized domains
- Create a Firestore database (for username rate-limiting)

### Server Deployment
The Socket.io server can be hosted on any Node.js-compatible platform:
- **Free:** Render, Fly.io, Koyeb, AWS EC2 Free Tier
- **Cheap:** Vultr ($3.50/mo), AWS Lightsail ($3.50/mo), Railway ($5/mo)

## 📄 License

Copyright © 2026 StreamSync. All rights reserved.

This software is proprietary and confidential. Unauthorized copying, modification, distribution, or use of this software, via any medium, is strictly prohibited without express written permission from the author.
