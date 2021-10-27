const express = require("express");
const app = express();
const path = require("path");
const bodyParser = require("body-parser");

const io = require("socket.io")(
  app.listen(process.env.PORT || 3000, () => {
    console.log("listening on 3000");
  }),
  {
    allowEIO3: true,
  }
);

app.use(express.static(path.join(__dirname, "")));

var users = [];

io.on("connection", (socket) => {
  console.log("a user connected with id", socket.id);
  socket.on("userconnect", (data) => {
    var otherUsers = users.filter((user) => user.meeting_id === data.meetingId);
    users.push({
      connectionId: socket.id,
      user_id: data.user_id,
      meeting_id: data.meetingId,
    });

    var userCount = users.length;

    // informing other users about new user connected
    otherUsers.forEach((user) => {
      socket.to(user.connectionId).emit("inform_others_about_me", {
        other_user_id: data.user_id,
        connectionId: socket.id,
        userNumber: userCount,
      });
    });

    // informing new user about other users
    socket.emit("inform_me_about_other_user", otherUsers);
  });

  socket.on("SDPProcess", (data) => {
    socket.to(data.to_connectionId).emit("SDPProcess", {
      message: data.message,
      from_connectionId: socket.id,
    });
  });

  socket.on("disconnect", () => {
    console.log("user disconnected");
    var disUser = users.find((user) => user.connectionId == socket.id);
    if (disUser) {
      var meetingId = disUser.meeting_id;
      users = users.filter((user) => user.connectionId != socket.id);
      var otherUsers = users.filter((user) => user.meeting_id === meetingId);
      otherUsers.forEach((user) => {
        var userNumberAfterLeave = users.length;
        socket.to(user.connectionId).emit("inform_others_about_me_disconnect", {
          other_user_id: disUser.user_id,
          connectionId: socket.id,
          userNumber: userNumberAfterLeave,
        });
      });
    }
  });

  socket.on("sendMessage", (data) => {
    console.log(data);
    var mUser = users.find((user) => user.connectionId == socket.id);
    if (mUser) {
      var meetingId = mUser.meeting_id;
      var from = mUser.user_id;
      var others = users.filter((user) => user.meeting_id === meetingId);
      others.forEach((user) => {
        socket.to(user.connectionId).emit("showChatMessage", {
          from: from,
          message: data,
        });
      });
    }
  });
});
