const express = require('express');
const http = require('http');
const socketIo = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

io.on('connection', (socket) => {
  
  socket.on('disconnect', () => {
  });
});

const PORT = 3000;
server.listen(PORT, () => {
});

// Keep the process running
process.on('SIGINT', () => {
  process.exit(0);
});

