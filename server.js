const express = require("express");
const app = express();
const http = require("http").createServer(app); // Corrected
const io = require("socket.io")(http, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

app.use(express.static("public"));

app.get("/", (req, res) => {
  res.send("Chat Server is Running!");
});

const users = {}; 

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
        // FIX: The previous typo "toDN" is fixed to "to" here
        io.to(room).emit("online users", getUsersInRoom(room));
      }
      delete users[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
http.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
