function timeLog() {
  [].unshift.apply(arguments, ["[" + Math.round((new Date().getTime())/10)%10000 + "]"]);
  console.log.apply(console, arguments);
}

function keys(anObject) {
  var keys = [];
  for(var key in anObject) {
    keys.push(key);
  }
  return keys;
}


$(function() {
  timeLog("Starting Maker component");

  var state = {
    id: undefined,
    channel: undefined,
    stream: undefined,
    peers: {},
    peerConnections: {}
  };

  // Get access to Webcam
  getUserMedia({audio: true, video: true}, function(stream) {
    state.stream = stream;
    goAttachLocalStream(stream);
    goReady();
  });

  // Open socket.io channel
  var channel = io.connect();
  channel.on('connect', function() {
    state.channel = channel;
    goReady();
  });
  channel.on('id', function(myId) {
    state.id = myId;
    goOnline();
  });

  // Peer connect/disconnect events
  channel.on('peer', function(data) {
    // TODO: Decide to pay attention only to a particular type of peer
    // a.k.a. Filter peers. Use prefix in the ID
    if('add' in data) {
      data['add'].forEach(function(peerId) {
        state.peers[peerId] = {};
        goPeerAdded(peerId);
      });
    }
    if('del' in data) {
      data['del'].forEach(function(peerId) {
        goPeerRemoved(peerId);
        delete state.peers[peerId];
      });
    }
  });

  // Self disconnect event
  channel.on('disconnect', function() {
    // Tear down all connections
    keys(state.peerConnection).forEach(function(peerId) {
      goDisconnect(peerId);
    });
    // Forget any information we think we have about connected peers
    state.peers = {};
    // And about ourselves
    state.channel = undefined;
    state.id = undefined;
  });

  function goReady() {
    // Don't start unless both socket.io and getUserMedia succeeded
    if(state.channel === undefined || state.stream === undefined) 
      return;

    channel.emit(config.self);
  }

  function goOnline() {
    // If we already know of any waiting peers, trigger a start with them
    keys(state.peers).forEach(function(peerId) {
      goPeerAdded(peerId);
    });
  }

  function goPeerAdded(peerId) {
    if(config.self == 'master'/* TODO: Configure auto-connect per-client */) {
      goConnect(peerId);
    }
  }
  function goPeerRemoved(peerId) {
    if(peerId in state.peerConnections) {
      goDisconnect(peerId);
    }
  }

  function goConnect(peerId) {
    $('#status').html('On Call with ' + peerId);
    var pcState = state.peerConnections[peerId] = {};
    pcState.role = 'slave';
    var pc = pcState.pc = makeWebRTCPC(peerId, state.stream);
    pc.createOffer(function(sdp) {
      pc.setLocalDescription(sdp);
      channel.emit('webrtc', {
        peerId: peerId,
        sdp: sdp
      });
    });
  }
  function goDisconnect(peerId) {
    $('#status').html('Disconnected from ' + peerId);
    // Cancel potential callbacks about this connection
    var pc = state.peerConnections[peerId].pc;
    pc.onicecandidate = pc.onaddstream = function() {};
    // TODO: Do a proper and clean disconnection from PC
    // TODO: Detach video from stream, if it had been attached
    delete state.peerConnections[peerId];
  }

  channel.on('webrtc', function(message) {
    var peerId = message.peerId;
    if(!(peerId in state.peerConnections)) {
      // We're getting messages from a peer we haven't initiated
      // connection to. We must be getting 'called'
      var pcState = state.peerConnections[peerId] = {};
      pcState.role = 'master';
      pcState.pc = makeWebRTCPC(peerId, state.stream);
    }
    var pcState = state.peerConnections[peerId];
    if('candidate' in message) {
      pcState.pc.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
    if('sdp' in message) {
      pcState.pc.setRemoteDescription(new RTCSessionDescription(message.sdp));
      if(pcState.role = 'master') {
        pcState.pc.createAnswer(function(sdp) {
          pcState.pc.setLocalDescription(sdp);
          channel.emit('webrtc', {
            peerId: peerId,
            sdp: sdp
          });
        });
      }
    }
  });

  function makeWebRTCPC(peerId, stream) {
    var pc =  new RTCPeerConnection(config.pcConfig);
    pc.addStream(state.stream);
    pc.onicecandidate = function(event) {
      if(event && event.candidate) {
        channel.emit('webrtc', {
          peerId: peerId,
          candidate: event.candidate
        });
      }
    };
    pc.onaddstream = function(event) {
      goAttachPeerStream(peerId, event.stream);
    };
    return pc;
  }

  function goAttachLocalStream(stream) {
    attachMediaStream($('#local-video')[0], stream);
  }
  function goAttachPeerStream(peerId, stream) {
    attachMediaStream($('#remote-video')[0], stream);
  }
});
