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
    console.log('received answer SDP', sdp);
    pc.setRemoteDescription(new RTCSessionDescription(sdp));
  });
  channel.on('webrtc candidate', function(candidate) {
    console.log('candidate', candidate);
    pc.addIceCandidate(new RTCIceCandidate(candidate));
  });

  // WebRTC
  var pc_config = { iceServers: [{ url: "stun:stun.l.google.com:19302" }]};
  var pc = new RTCPeerConnection(pc_config);

  var stream = stream;
  getUserMedia({audio: true, video: true}, function(stream) {
    // Show webcam on local element
    attachMediaStream($('#local-video')[0], stream);

    // Adding stream to Peer Connection
    pc.addStream(stream);
  });

  // Initiate WebRTC process
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
  pc.onremovestream = function() {
    console.log('onremovestream');
  };
  pc.onaddstream = function() {
    console.log('onaddstream');
  };

  $('#connect').on('click',function(ev) {
    pc.createOffer(function(sdp){
      console.log('createOffer callback. Setting local SDP', sdp);
      pc.setLocalDescription(sdp);
      channel.emit('webrtc sdp', sdp);
    });

    console.log('attached local stream to PC');
 });

  function render() {
    var statusDiv = $('#status');
    statusDiv.children().remove();
    audience.forEach(function(entry) {
      console.log('rendering: ' + entry);
      statusDiv.append($('<span>' + entry + '</span>'));
    });
  }
  // When new users connect (notified via socket.io)
  // start broadcasting to them
});
