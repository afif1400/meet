const express = require('express');
const app = express();
const path = require('path');
const bodyParser = require('body-parser');


const io = require('socket.io')(app.listen(3000, () => {
  console.log('listening on 3000');
}), {
  allowEIO3: true
});

app.use(express.static(path.join(__dirname, '')));

var users = []

io.on("connection", (socket) => {
  console.log("a user connected with id", socket.id);
  socket.on("userconnect", (data) => {

    var otherUsers = users.filter(user => user.meeting_id === data.meetingId);
    users.push({
      connectionId: socket.id,
      user_id: data.user_id,
      meeting_id: data.meetingId
    });


    // informing other users about new user connected
    otherUsers.forEach(user => {
      socket.to(user.connectionId).emit("inform_others_about_me", {
        other_user_id: data.user_id,
        connectionId: socket.id
      });
    });

    // informing new user about other users
    socket.emit("inform_me_about_other_user", otherUsers)
  })

  socket.on("SDPProcess", (data) => {
    socket.to(data.to_connectionId).emit("SDPProcess", {
      message: data.message,
      from_connectionId: socket.id
    });
  })
})
