const express = require('express');
const path = require('path');
const os = require('os');

const app = express();
const http = require('http').Server(app);
const io = require('socket.io')(http);

const port = process.env.PORT || 3000;

app.use(express.static(path.join(__dirname, '../client/dist')));

io.on('connection', (socket) => {
  function log() {
    const array = ['Message from server:'];
    array.push.apply(array, arguments);
    socket.emit('log', array);
  }

  socket.on('chat message', (msg) => {
    io.emit('chat message', msg);
  });

  socket.on('message', (msg) => {
    log('Client said: ', msg);
    socket.broadcast.emit('message', msg);
  });

  socket.on('create or join', (room) => {
    log(`Received request to create or join room ${room}`);
    const clientsInRoom = io.sockets.adapter.rooms[room];
    const numClients = clientsInRoom ? Object.keys(clientsInRoom.sockets).length : 0;
    log(`Room ${room} now has ${numClients} client(s)`);

    if (numClients === 0) {
      socket.join(room);
      log(`Client ID ${socket.id} created room ${room}`);
      socket.emit('created', room, socket.id);

    } else if (numClients === 1) {
      log(`Client ID ${socket.id} joined room ${room}`);
      io.sockets.in(room).emit('join', room);
      socket.join(room);
      socket.emit('joined', room, socket.id);
      io.sockets.in(room).emit('ready');
    } else {
      socket.emit('full', room);
    }
  });

  socket.on('ipaddr', () => {
    const ifaces = os.networkInterfaces();
    const keys = Object.keys(ifaces);
    for (let i = 0; i < keys.length; i += 1) {
      ifaces[keys[i]].forEach((details) => {
        if (details.family === 'IPv4' && details.address !== '127.0.0.1') {
          socket.emit('ipaddr', details.address);
        }
      });
    }
  });
});

http.listen(port, () => {
  console.log(`listening on port: ${port}`);
});
