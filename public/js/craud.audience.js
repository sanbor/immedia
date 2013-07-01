$(function() {
  console.log("Starting audience component");

  // Open socket.io connection
  var channel = io.connect();
  channel.on('disconnect',function() {
   $('#connect').html('Connect').removeAttr('disabled');
  });

  // Tell server about our existance (via socket.io) and wait for
  // video to start streaming to us
  $('#connect').on('click',function(ev) {
    $('#connect').html('Connected').attr('disabled','disabled');
    channel.emit('audience',$('#name').val());
  });


  channel.on('webrtc candidate',function(candidate) {
    console.log('candidate', candidate);
    pc.addIceCandidate(new RTCIceCandidate(candidate));
  });
  channel.on('webrtc candidates',function(candidates) {
    candidates.forEach(function(candidate) {
      console.log('candidate', candidate);
      pc.addIceCandidate(new RTCIceCandidate(candidate));
    });
  });

  channel.on('webrtc sdp',function(sdp) {
    console.log('Setting remote SDP', sdp);
    pc.setRemoteDescription(new RTCSessionDescription(sdp));
    pc.createAnswer(function(localsdp) {
      console.log('Creating and sending answer SDP', localsdp);
      pc.setLocalDescription(localsdp);
      channel.emit('webrtc sdp', localsdp);
    });
  });

  // WebRTC
  var pc_config = { iceServers: [{ url: "stun:stun.l.google.com:19302" }]};
  var pc = new RTCPeerConnection(pc_config);
  console.log('PC object created');
  pc.onicecandidate = function(event) {
    console.log('onicecandidate', (event && event.candidate));
    if( event && event.candidate) {
      channel.emit('webrtc candidate', event.candidate);
      console.log('emitted');
    } else {
      console.log('skipped');
    }
  };
  pc.onconnecting = function() {
    console.log('onconnecting');
  };
  pc.onopen = function() {
    console.log('onopen');
  };
  pc.onaddstream = function(evt) {
    console.log('onaddstream', evt);
    attachMediaStream($('#remote-video')[0], evt.stream);
  };
  pc.onremovestream = function() {
    console.log('onremovestream');
  };

});
