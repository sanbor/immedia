$(function() {
  console.log("Starting Maker component");

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

  channel.on('webrtc sdp', function(sdp) {
    pc.setRemoteDescription(sdp);
  });

  // WebRTC
  var pc_config = { iceServers: [{ url: "stun:stun.l.google.com:19302" }]};
  var pc = new RTCPeerConnection(pc_config);
  pc.onicecandidate = function(event) {
    console.log('onicecandidate: ' + (event && event.candidate));
    channel.emit('webrtc candidate', event.candidate);
  };
  pc.onconnecting = function() {};
  pc.onopen = function() {};
  pc.onaddstream = function() {};
  pc.onremovestream = function() {};
  pc.createOffer(function(sdp){
    console.log('createOffer callback: ' + sdp);
    pc.setLocalDescription(sdp);
    channel.emit('webrtc sdp', sdp);
  });

  getUserMedia({audio: true, video: true}, function(stream) {
    // Show webcam on local element
    attachMediaStream($('#local-video')[0], stream);
    // And make it available for streaming
    pc.addStream(stream);
  });

  function render() {
    var statusDiv = $('#status');
    statusDiv.children().remove();
    audience.forEach(function(entry) {
      console.log('rendering: ' + entry);
      statusDiv.append($('<span>' + entry + '</span>'));
    });
  };
  // When new users connect (notified via socket.io)
  // start broadcasting to them
});
