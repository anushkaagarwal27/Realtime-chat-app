const express = require("express");
const app = express();
const http = require("http").createServer(app);
const io = require("socket.io")(http);

app.use(express.static("public"));

const users = {}; // socket.id -> { user, rooms: Set }

function getUsersInRoom(room) {
  return Object.entries(users)
    .filter(([_, u]) => u.rooms.has(room))
    .map(([_, u]) => ({ user: u.user }));
}

io.on("connection", (socket) => {
  users[socket.id] = { user: null, rooms: new Set() };

  socket.on("join room", ({ room, user }) => {
    if (!users[socket.id].user) users[socket.id].user = user;
    users[socket.id].rooms.add(room);
    socket.join(room);

    io.to(room).emit("system message", {
      msg: `${user} joined ${room}.`,
      time: Date.now(),
      room,
    });

    io.to(room).emit("online users", getUsersInRoom(room));
  });

  socket.on("chat message", ({ room, user, msg }) => {
    const payload = {
      user,
      msg,
      room,
      time: Date.now(),
      id: `${Date.now()}-${socket.id}`,
    };
    io.to(room).emit("chat message", payload);
  });

  socket.on("message read", ({ room, msgId }) => {
    socket.to(room).emit("message read", { msgId });
  });

  socket.on("disconnect", () => {
    const info = users[socket.id];
    if (info) {
      for (const room of info.rooms) {
        io.to(room).emit("system message", {
          msg: `${info.user} left ${room}.`,
          time: Date.now(),
          room,
        });
        io.to(room).emit("online users", getUsersInRoom(room));
      }
      delete users[socket.id];
    }
  });
});

http.listen(3000, () => {
  console.log("Server running at http://localhost:3000");
});
