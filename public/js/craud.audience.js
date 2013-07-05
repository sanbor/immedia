var pc;
$(function() {
  timeLog("Starting audience component");

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


  var remoteCandidates = [];
  channel.on('webrtc candidate',function(candidate) {
    timeLog('candidate', candidate);
    // pc.addIceCandidate(new RTCIceCandidate(candidate));
    remoteCandidates.push(new RTCIceCandidate(candidate));
  });
  channel.on('webrtc candidates',function(candidates) {
    candidates.forEach(function(candidate) {
      timeLog('candidate', candidate);
      // pc.addIceCandidate(new RTCIceCandidate(candidate));
      remoteCandidates.push(new RTCIceCandidate(candidate));
    });
  });

  channel.on('webrtc sdp',function(sdp) {
    timeLog('Setting remote SDP', sdp);
    pc.setRemoteDescription(new RTCSessionDescription(sdp));
    remoteCandidates.forEach(function(candidate) {
      pc.addIceCandidate(candidate);
    });
    // LEARN: Creating an answer can take as long as we want
    setTimeout(function() {
      timeLog('will create answer');
      pc.createAnswer(function(localsdp) {
        timeLog('Creating and sending answer SDP', localsdp);
        pc.setLocalDescription(localsdp);
        // LEARN: If you don't send the answer within 3 seconds
        // of having created it, the session doesn't begin
        setTimeout(function() {
          timeLog('Emitting answer');
          channel.emit('webrtc sdp', localsdp);
        }, 2000);
      });
    }, 100);
  });

  // WebRTC
  var pc_config = { iceServers: [{ url: "stun:stun.l.google.com:19302" }]};
  pc = new RTCPeerConnection(pc_config);
  timeLog('PC object created');
  pc.onicecandidate = function(event) {
    // LEARN: We don't need to add our own ICE candidates?
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
  pc.onaddstream = function(evt) {
    timeLog('onaddstream', evt);
    attachMediaStream($('#remote-video')[0], evt.stream);
  };
  pc.onremovestream = function() {
    timeLog('onremovestream');
  };

});
