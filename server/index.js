const express = require('express');
const http = require('http');
const path = require('path');
// const morgan = require('morgan');
const sio = require('socket.io');

const app = express();
const server = http.Server(app);
const io = sio(server);

// app.use(morgan('dev'));
app.use(express.static(path.join(__dirname, '../client/dist')));

io.on('connection', (socket) => {
  console.log('a user connected');
  socket.on('disconnect', () => {
    console.log('user disconnected');
  });
  socket.on('message', (msg) => {
    console.log('message:', msg);
  });
});

server.listen(3000, () => {
  console.log('listening on http://localhost:3000');
});
