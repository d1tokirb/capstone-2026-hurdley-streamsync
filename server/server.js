const express = require('express');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Allow connection from any extension/page for MVP
        methods: ["GET", "POST"]
    }
});

// Store room state potentially if needed, but for now we just relay messages
// rooms = { 'roomID': { clients: [], currentState: { ... } } }

const rooms = {};

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    let currentRoom = null;
    let currentUser = "Anonymous";

    socket.on('join-room', (data) => {
        // Handle legacy or old client (string/object check)
        const roomId = (typeof data === 'string') ? data : data.roomId;
        const username = (typeof data === 'object' && data.username) ? data.username : "Anonymous";
        currentUser = username;

        // Leave previous room if any
        if (currentRoom) {
            socket.leave(currentRoom);
            if (rooms[currentRoom]) {
                rooms[currentRoom].clients.delete(socket.id);
                if (rooms[currentRoom].clients.size === 0) {
                    delete rooms[currentRoom];
                }
            }
        }

        currentRoom = roomId;
        socket.join(roomId);
        console.log(`User ${socket.id} (${username}) joined room: ${roomId}`);

        // Initialize room if it doesn't exist
        if (!rooms[roomId]) {
            rooms[roomId] = {
                hostId: socket.id,
                currentUrl: null,
                clients: new Set(),
                usernames: {},
                settings: {
                    syncSensitivity: 0.5,
                    strictMode: false,
                    autoPause: false
                }
            };
            console.log(`Room ${roomId} created. Host: ${socket.id}`);
        }

        rooms[roomId].clients.add(socket.id);
        rooms[roomId].usernames[socket.id] = username;

        // Send current room state to the new joiner
        socket.emit('room-state', {
            isHost: rooms[roomId].hostId === socket.id,
            currentUrl: rooms[roomId].currentUrl,
            settings: rooms[roomId].settings
        });

        // Notify others
        socket.to(roomId).emit('chat-message', {
            senderId: 'SYSTEM',
            username: 'SYSTEM',
            text: `${username} joined the room.`,
            isSystem: true
        });
    });

    socket.on('sync-event', (data) => {
        if (!currentRoom) return;
        socket.to(currentRoom).emit('sync-event', {
            ...data,
            senderId: socket.id
        });
    });

    // Chat Message
    socket.on('chat-message', (message) => {
        if (!currentRoom) return;
        io.to(currentRoom).emit('chat-message', {
            senderId: socket.id,
            username: currentUser,
            text: message,
            timestamp: Date.now()
        });
    });

    // Ad Event
    socket.on('ad-event', (data) => {
        if (!currentRoom) return;
        const message = (data.type === 'start')
            ? `⚠️ ${currentUser} is watching an ad. Pausing room.`
            : `✅ ${currentUser}'s ad finished. Resuming...`;

        io.to(currentRoom).emit('chat-message', {
            senderId: 'SYSTEM',
            username: 'SYSTEM',
            text: message,
            isSystem: true
        });
    });

    // Change Video URL (Host Only)
    socket.on('change-url', (newUrl) => {
        if (!currentRoom || !rooms[currentRoom]) return;

        if (socket.id !== rooms[currentRoom].hostId) {
            socket.emit('error', 'Only the host can change the video.');
            return;
        }

        console.log(`[${currentRoom}] URL changed to: ${newUrl}`);
        rooms[currentRoom].currentUrl = newUrl;

        // Broadcast new URL to everyone in the room
        io.to(currentRoom).emit('url-change', newUrl);

        io.to(currentRoom).emit('chat-message', {
            senderId: 'SYSTEM',
            username: 'SYSTEM',
            text: `Host changed video.`,
            isSystem: true
        });
    });

    // Update Room Settings (Host Only)
    socket.on('update-room-settings', (newSettings) => {
        if (!currentRoom || !rooms[currentRoom]) return;

        if (socket.id !== rooms[currentRoom].hostId) {
            socket.emit('error', 'Only the host can change room settings.');
            return;
        }

        // Merge new settings
        rooms[currentRoom].settings = { ...rooms[currentRoom].settings, ...newSettings };
        console.log(`[${currentRoom}] Settings updated:`, rooms[currentRoom].settings);

        // Broadcast to everyone in the room
        io.to(currentRoom).emit('room-settings-updated', rooms[currentRoom].settings);
    });

    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        if (currentRoom && rooms[currentRoom]) {
            rooms[currentRoom].clients.delete(socket.id);
            delete rooms[currentRoom].usernames[socket.id];

            // Notify others
            io.to(currentRoom).emit('chat-message', {
                senderId: 'SYSTEM',
                username: 'SYSTEM',
                text: `${currentUser} left the room.`,
                isSystem: true
            });

            // If host left, assign new host if anyone remains
            if (rooms[currentRoom].hostId === socket.id) {
                if (rooms[currentRoom].clients.size > 0) {
                    const newHost = Array.from(rooms[currentRoom].clients)[0];
                    rooms[currentRoom].hostId = newHost;
                    const newHostName = rooms[currentRoom].usernames[newHost] || "Unknown";

                    io.to(currentRoom).emit('host-update', { newHostId: newHost });
                    io.to(newHost).emit('you-are-host');

                    io.to(currentRoom).emit('chat-message', {
                        senderId: 'SYSTEM',
                        username: 'SYSTEM',
                        text: `${newHostName} is now the host.`,
                        isSystem: true
                    });

                    console.log(`Room ${currentRoom} host migrated to ${newHost}`);
                } else {
                    delete rooms[currentRoom];
                }
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
});
