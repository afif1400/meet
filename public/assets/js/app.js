const AppProcess = (() => {
  const iceConfiguration = {
    iceServers: [
      {
        urls: 'stun:stun.l.google.com:19302',
      },
      {
        urls: 'stun:stun1.l.google.com:19302',
      }
    ],
  };

  let peers_connection_ids = [];
  let peer_connection = [];
  let remote_video_stream = [];
  let remote_audio_stream = [];
  let serverProcess;
  let local_div;
  let audio;
  let isAudioMute = true;
  let rtp_aud_senders = []
  let rtp_vid_senders = []
  let video_states = {
    None: 0,
    Camera: 1,
    ScreenShare: 2
  }
  let videoCamTrack;

  let video_state = video_states.None;

  const _init = async (SDP_function, connectionId) => {
    serverProcess = SDP_function;
    my_connection_id = connectionId;
    eventProcess();
    local_div = document.getElementById('localVideoPlayer');
  }

  const loadAudio = async () => {
    try {
      let atream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      audio = atream.getAudioTracks()[0];
      audio.enabled = false;
    } catch (e) {
      console.log(e);
    }
  }


  const eventProcess = async () => {
    $('#micMuteUnmute').on('click', async () => {

      if (!audio) {
        await loadAudio();
      }

      if (!audio) {
        alert("Audio permission has not granted")
        return;
      }
      if (isAudioMute) {
        audio.enabled = true;
        $("#micMuteUnmute").html("<span class='material-icons special-icons'>mic</span>")
        updateMediaSenders(audio, rtp_aud_senders);
      } else {
        audio.enabled = false;
        $("#micMuteUnmute").html("<span class='material-icons special-icons'>mic_off</span>")
        removeMediaSenders(rtp_aud_senders);
      }

      isAudioMute = !isAudioMute;
    })

    $("#videoCamOnOff").on("click", async () => {
      if (video_state == video_states.Camera) {
        await videoProcess(video_states.None);
      } else {
        await videoProcess(video_states.Camera);
      }
    })

    $("#ScreenShareOnOff").on("click", async () => {
      if (video_state == video_states.ScreenShare) {
        await videoProcess(video_states.None);
      } else {
        await videoProcess(video_states.ScreenShare);
      }
    })
  }


  const connection_status = (connection) => {
    if (connection && (connection.connectionState == "new" || connection.connectionState == "connecting" || connection.connectionState == "connected")) {
      return true;
    } else {
      return false
    }
  }

  const updateMediaSenders = (track, rtp_senders) => {
    for (var conId in peers_connection_ids) {
      if (connection_status(peer_connection[conId])) {
        if (rtp_senders[conId] && rtp_senders[conId].track) {
          rtp_senders[conId].replaceTrack(track);
        } else {
          rtp_senders[conId] = peer_connection[conId].addTrack(track);
        }
      }
    }
  }

  const removeMediaSenders = (rtp_senders) => {
    for (var conId in peers_connection_ids) {
      if (rtp_senders[conId] && connection_status(peer_connection[conId])) {
        peer_connection[conId].removeTrack(rtp_senders[conId]);
        rtp_senders[conId] = null;
      }
    }
  }

  const removeVideoStream = async = (rtp_vid_senders) => {
    if (videoCamTrack) {
      videoCamTrack.stop();
      videoCamTrack = null;
      local_div.srcObject = null;
      removeMediaSenders(rtp_vid_senders);
    }
  }

  const videoProcess = async (newVideoState) => {
    if (newVideoState == video_states.None) {
      $("#videoCamOnOff").html("<span class='material-icons special-icons'>videocam_off</span>")
      $("#ScreenShareOnOff").html(
        "<span class='material-icons special-icons'>present_to_all</span><div>Present Now</div>"
      )
      video_state = newVideoState
      removeVideoStream(rtp_vid_senders);
      return
    }

    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html("<span class='material-icons special-icons''>videocam_on</span>")
    }

    let vstream = null;
    try {
      if (newVideoState === video_states.Camera) {
        vstream = await navigator.mediaDevices.getUserMedia({
          video: {
            width: 1920,
            height: 1080
          },
          audio: false
        });
      } else if (newVideoState === video_states.ScreenShare) {
        vstream = await navigator.mediaDevices.getDisplayMedia({
          video: {
            width: 1920,
            height: 1080
          },
          audio: false
        });
        vstream.oninactive = () => {
          removeVideoStream(rtp_vid_senders);
          $("#ScreenShareOnOff").html(
            "<span class='material-icons special-icons'>present_to_all</span><div>Present Now</div>"
          )
        }
      }
      if (vstream && vstream.getVideoTracks().length > 0) {
        videoCamTrack = vstream.getVideoTracks()[0];
        if (videoCamTrack) {
          local_div.srcObject = new MediaStream([videoCamTrack]);
          updateMediaSenders(videoCamTrack, rtp_vid_senders);
        }
      }
    } catch (error) {
      console.log(error);
      return;
    }

    video_state = newVideoState;

    if (newVideoState == video_states.Camera) {
      $("#videoCamOnOff").html(
        "<span class='material-icons special-icons'>videocam</span>"
      )
      $("#ScreenShareOnOff").html(
        "<span class='material-icons special-icons'>present_to_all</span><div>Present Now</div>"
      )
    } else if (newVideoState == video_states.ScreenShare) {
      $("#ScreenShareOnOff").html("<span class='material-icons text-success'>present_to_all</span><div class='text-success'>Stop Presenting</div>")
      $("#videoCamOnOff").html("<span class='material-icons special-icons'>videocam_off</span>")
    }
  }

  const setNewConnection = async (connectionId) => {

    const connection = new RTCPeerConnection(iceConfiguration)

    connection.onnegotiationneeded = async (event) => {
      await setOffer(connectionId);
    }

    connection.onicecandidate = (event) => {
      if (event.candidate) {
        serverProcess(
          JSON.stringify({
            icecandidate: event.candidate,
          }), connectionId
        )
      }
    }

    connection.ontrack = (event) => {
      if (!remote_video_stream[connectionId]) {
        remote_video_stream[connectionId] = new MediaStream();
      }
      if (!remote_audio_stream[connectionId]) {
        remote_audio_stream[connectionId] = new MediaStream();
      }

      if (event.track.kind === 'video') {
        remote_video_stream[connectionId].getVideoTracks().forEach(track => {
          remote_video_stream[connectionId].removeTrack(track);
        });

        remote_video_stream[connectionId].addTrack(event.track);

        var remoteVideoPlayer = document.getElementById('v_' + connectionId);
        remoteVideoPlayer.srcObject = remote_video_stream[connectionId];
        remoteVideoPlayer.load();
      } else if (event.track.kind === 'audio') {
        remote_audio_stream[connectionId].getAudioTrack().forEach(track => {
          remote_audio_stream[connectionId].removeTrack(track);
        });

        remote_audio_stream[connectionId].addTrack(event.track);
        var remoteAudioPlayer = document.getElementById('a_' + connectionId);
        remoteAudioPlayer.srcObject = remote_audio_stream[connectionId];
        remoteAudioPlayer.load();
      }
    }
    peers_connection_ids[connectionId] = connectionId;
    peer_connection[connectionId] = connection;

    if (video_state == video_states.Camera || video_state == video_states.ScreenShare) {
      // await videoProcess(video_states.Camera);
      if (videoCamTrack) {
        updateMediaSenders(videoCamTrack, rtp_vid_senders);
      }
    }

    return connection;
  }


  const SDPProcess = async (message, from_connectionId) => {
    message = JSON.parse(message);
    if (message.answer) {
      peer_connection[from_connectionId].setRemoteDescription(new RTCSessionDescription(message.answer));
    } else if (message.offer) {
      if (!peer_connection[from_connectionId]) {
        await setNewConnection(from_connectionId);
      }
      await peer_connection[from_connectionId].setRemoteDescription(new RTCSessionDescription(message.offer));
      const answer = await peer_connection[from_connectionId].createAnswer()
      await peer_connection[from_connectionId].setLocalDescription(answer);
      serverProcess(
        JSON.stringify({
          answer: answer,
        }), from_connectionId
      )
    } else if (message.icecandidate) {
      if (!peer_connection[from_connectionId]) {
        await setNewConnection(from_connectionId);
      }
      try {
        await peer_connection[from_connectionId].addIceCandidate(message.icecandidate);
      } catch (e) {
        console.log(e);
      }
    }
  }

  const setOffer = async (connectionId) => {
    const connection = peer_connection[connectionId];
    const offer = await connection.createOffer()
    await connection.setLocalDescription(offer);
    serverProcess(
      JSON.stringify({
        offer: connection.localDescription,
      }), connectionId
    )

  }

  return {
    setNewConnection: async (connectionId) => {
      await setNewConnection(connectionId)
    },
    init: async (SDP_function, connectionId) => {
      await _init(SDP_function, connectionId)
    },
    processClientFunction: async (data, from_connectionId) => {
      await SDPProcess(data, from_connectionId)
    },
  }
})();

const App = (() => {

  const init = (uid, mid) => {
    const user_id = uid;
    const meeting_id = mid;
    $('#meetingContainer').show();
    $('#me h2').text(user_id + "(me)");
    document.title = user_id;
    event_process_for_signaling_server(user_id, meeting_id);
  };

  var socket = null;
  const event_process_for_signaling_server = (user_id, meeting_id) => {
    socket = io.connect('');

    const SDP_function = (data, to_connectionId) => {
      socket.emit('SDPProcess', {
        message: data,
        to_connectionId: to_connectionId
      });
    }

    socket.on('connect', () => {
      if (socket.connected) {
        AppProcess.init(SDP_function, socket.id);
        if (user_id != null && meeting_id != null) {
          socket.emit("userconnect", {
            user_id: user_id,
            meetingId: meeting_id
          })
        }
      }
      console.log('connected');
    });

    socket.on(
      "inform_others_about_me",
      (data) => {
        addUser(data.other_user_id, data.connectionId);
        AppProcess.setNewConnection(data.connectionId);
      }
    )

    socket.on("inform_me_about_other_user", (otherUsers) => {
      console.log("inform_me_about_other_user", otherUsers);
      for (var i = 0; i < otherUsers.length; ++i) {
        addUser(otherUsers[i].user_id, otherUsers[i].connectionId);
        AppProcess.setNewConnection(otherUsers[i].connectionId);
      }
    })

    socket.on("SDPProcess", async (data) => {
      await AppProcess.processClientFunction(data.message, data.from_connectionId);
    })
  }

  const addUser = (user_id, connectionId) => {
    let newDiv = $("#otherTemplate").clone();
    newDiv = newDiv.attr("id", connectionId).addClass("other");
    newDiv.find("h2").text(user_id);
    newDiv.find("video").attr("id", "v_" + connectionId);
    newDiv.find("audio").attr("id", "a_" + connectionId);
    newDiv.show();

    $("#divUsers").append(newDiv);
  }

  return {
    _init: (uid, mid) => {
      init(uid, mid);
    }
  }
})();