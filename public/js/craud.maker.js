var pc;
$(function() {
  timeLog("Starting Maker component");

  var audience = [];
 // Open socket.io channel and Webcam capture
  var channel = io.connect();
  channel.on('connect', function() {
    channel.emit('maker');
  });
  channel.on('audience add', function(name) {
    audience.push(name);
    render();
  });
  channel.on('audience del', function(name) {
    var ix = audience.indexOf(name);
    if(ix != -1) {
      audience.splice(ix, 1);
      render();
    }
  });
  channel.on('audience all', function(names) {
    audience = names;
    render();
  });

  var remoteDesc;
  $('#set-remote-sdp').on('click',function(ev) {
    timeLog('connecting answer', remoteDesc);
    pc.setRemoteDescription(remoteDesc);
  });
  channel.on('webrtc sdp', function(sdp) {
    timeLog('received answer SDP', sdp);
    remoteDesc = new RTCSessionDescription(sdp);
    // LEARN: If you don't set the remote description
    // within a few (less than 5) seconds, the connection
    // doesn't happen
    // setTimeout(function() {
      pc.setRemoteDescription(remoteDesc);
    // }, 100);
  });
  channel.on('webrtc candidate', function(candidate) {
    timeLog('candidate', candidate);
    pc.addIceCandidate(new RTCIceCandidate(candidate));
  });

  // WebRTC
  var pc_config = { iceServers: [{ url: "stun:stun.l.google.com:19302" }]};
  pc = new RTCPeerConnection(pc_config);

  var stream = stream;
  getUserMedia({audio: true, video: true}, function(stream) {
    // Show webcam on local element
    attachMediaStream($('#local-video')[0], stream);

    // Adding stream to Peer Connection
    pc.addStream(stream);
  });

  // Initiate WebRTC process
  pc.onicecandidate = function(event) {
    timeLog('onicecandidate', (event && event.candidate));
    if( event && event.candidate) {
      channel.emit('webrtc candidate', event.candidate);
      timeLog('emitted');
    } else {
      timeLog('skipped');
    }
  };

  pc.onconnecting = function() {
    timeLog('onconnecting');
  };
  pc.onopen = function() {
    timeLog('onopen');
  };
  pc.onremovestream = function() {
    timeLog('onremovestream');
  };
  pc.onaddstream = function() {
    timeLog('onaddstream');
  };

  // Trigger ICE agent (we'll ignore the created offer)
  pc.createOffer(function(sdp){
    pc.setLocalDescription(sdp);
  });

  $('#connect').on('click',function(ev) {
    // LEARN: Can I re-use ICE candidates from an old PC?
    // (Couldn't get it to work yet)
    pc = new RTCPeerConnection(pc_config);
    pc.onicecandidate = function() {};
    channel.removeAllListeners('webrtc candidate');

    pc.createOffer(function(sdp){
      timeLog('createOffer callback. Setting local SDP', sdp);
      pc.setLocalDescription(sdp);
      channel.emit('webrtc sdp', sdp);
    });

    timeLog('attached local stream to PC');
 });

  function render() {
    var statusDiv = $('#status');
    statusDiv.children().remove();
    audience.forEach(function(entry) {
      timeLog('rendering: ' + entry);
      statusDiv.append($('<span>' + entry + '</span>'));
    });
  }
  // When new users connect (notified via socket.io)
  // start broadcasting to them
});
