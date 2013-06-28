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
    pc.setRemoteDescription(sdp);
    pc.createAnswer(sdp, function(sdp) {
      pc.setLocalDescription(sdp);
      socket.emit('webrtc sdp', sdp);
    });
  });

  // WebRTC
  var pc_config = { iceServers: [{ url: "stun:stun.l.google.com:19302" }]};
  var pc = new RTCPeerConnection(pc_config);
  pc.onicecandidate = function(event) {};
  pc.onconnecting = function() {};
  pc.onopen = function() {};
  pc.onaddstream = function(stream) {
    console.log('got maker stream');
    attachMediaStream($('#remote-video')[0], stream);
  };
  pc.onremovestream = function() {};

});
