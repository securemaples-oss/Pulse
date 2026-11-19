# Discord-Style DM Chat App

A lightweight, real-time Direct Messaging web app inspired by Discord. Users sign up and log in using **only a username and password**—no email address, phone number, or personal details required.

## Features
- **Username & Password Only:** Instant account creation and login with hashed passwords (`bcryptjs`).
- **Real-Time Direct Messages:** Powered by WebSockets (`Socket.IO`) for instant 1-on-1 messaging.
- **Online Status Indicators:** See which users are currently online in the left sidebar.
- **Persistent Chat History:** Messages and accounts are saved locally in SQLite (`chat.db`).
- **Discord Dark UI:** Clean dark theme with user avatars and searchable DM sidebar.

## How to Run Locally
1. Make sure you have **Node.js** (v18 or newer) installed.
2. Open a terminal inside this folder and install dependencies:
   ```bash
   npm install
   ```
3. Start the server:
   ```bash
   npm start
   ```
4. Open your browser to `http://localhost:3000`.

## Uploading to GitHub
1. Create a new repository on GitHub.
2. Upload all files from this folder (the `.gitignore` automatically excludes `node_modules` and `chat.db`).
3. You can deploy this Node.js app to platforms like Render, Railway, or Fly.io directly from your GitHub repo.
