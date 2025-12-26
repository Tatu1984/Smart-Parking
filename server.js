// Custom server with Socket.IO support
// Run with: node server.js

const { createServer } = require('http');
const { parse } = require('url');
const next = require('next');
const { Server } = require('socket.io');

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url, true);
    handle(req, res, parsedUrl);
  });

  // Initialize Socket.IO
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
      methods: ['GET', 'POST'],
      credentials: true,
    },
    transports: ['websocket', 'polling'],
    pingTimeout: 60000,
    pingInterval: 25000,
  });

  // Store socket server globally for API routes
  global.socketIO = io;

  // Handle socket connections
  io.on('connection', (socket) => {
    console.log(`Client connected: ${socket.id}`);

    // Join parking lot room
    socket.on('join:parking-lot', (parkingLotId) => {
      socket.join(`parking-lot:${parkingLotId}`);
      console.log(`Socket ${socket.id} joined parking-lot:${parkingLotId}`);
    });

    // Join zone room
    socket.on('join:zone', (zoneId) => {
      socket.join(`zone:${zoneId}`);
      console.log(`Socket ${socket.id} joined zone:${zoneId}`);
    });

    // Join wallet room (requires auth in production)
    socket.on('join:wallet', (walletId) => {
      socket.join(`wallet:${walletId}`);
      console.log(`Socket ${socket.id} joined wallet:${walletId}`);
    });

    // Leave rooms
    socket.on('leave:parking-lot', (parkingLotId) => {
      socket.leave(`parking-lot:${parkingLotId}`);
    });

    socket.on('leave:zone', (zoneId) => {
      socket.leave(`zone:${zoneId}`);
    });

    socket.on('leave:wallet', (walletId) => {
      socket.leave(`wallet:${walletId}`);
    });

    // Handle disconnect
    socket.on('disconnect', (reason) => {
      console.log(`Client disconnected: ${socket.id}, reason: ${reason}`);
    });
  });

  httpServer.listen(port, () => {
    console.log(`> Ready on http://${hostname}:${port}`);
    console.log('> Socket.IO server initialized');
  });
});
