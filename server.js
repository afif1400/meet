const express = require("express");
const app = express();
const path = require("path");
const { json } = require("body-parser");
const fs = require("fs");
const fileUpload = require("express-fileupload");

const io = require("socket.io")(
  app.listen(process.env.PORT || 3000, () => {
    console.log("listening on 3000");
  }),
  {
    allowEIO3: true,
  }
);

app.use(json());

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
  }); socket.on("file-transfer-to-other", (data) => {
    const { username, meetingId, fileName, filePath } = data
    var mUser = users.find((user) => user.connectionId == socket.id);
    if (mUser) {
      var meetingid = mUser.meeting_id;
      var from = mUser.user_id;
      var others = users.filter((user) => user.meeting_id === meetingid);
      others.forEach((user) => {
        socket.to(user.connectionId).emit("showFileMessage", {
          username,
          meetingId,
          fileName,
          filePath
        });
      });
    }
  });

});

app.use(fileUpload());

app.post('/api/attach', (req, res) => {
  const data = req.body;
  var imageFile = req.files.zipfile;

  var dir = "public/attachment/" + data.meeting_id + "/"
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir);
  }

  imageFile.mv(dir + imageFile.name, function (err) {
    if (err) {
      return res.status(500).send(err);
    }
    res.status(200).send('File uploaded!');
  }
  );
})