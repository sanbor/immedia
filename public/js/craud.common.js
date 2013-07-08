function timeLog() {
  [].unshift.apply(arguments, ["[" + Math.round((new Date().getTime())/10)%10000 + "]"]);
  console.log.apply(console, arguments);
}

// Version configuration
config.version = 0.1;

function keys(anObject) {
  var keys = [];
  for(var key in anObject) {
    keys.push(key);
  }
  return keys;
}

// TODO: Delete. This is a outside debugging hook
var state;

$(function() {
  timeLog("Starting Maker component");

//  var state = {
  state = {
    id: undefined,
    channel: undefined,
    stream: undefined,
    peers: {},
    peerConnections: {},
    // peerId is used to make it easier to handle the
    // one-to-one case, ignoring the multi-peer support
    // on the rest of the code
    peerId: undefined
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

  // System hooks e.g.: request reload
  channel.on('system', function(data) {
    if('reload' in data) {
      window.location.reload();
    }
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
    goOffline();
  });

  function goReady() {
    // Don't start unless both socket.io and getUserMedia succeeded
    if(state.channel === undefined || state.stream === undefined) 
      return;

    // When everything is ready locally, announce our existence to server
    // and get an ID assigned
    channel.emit(config.self);
  }

  function goOnline() {
    // If we already know of any waiting peers, trigger a start with them
    keys(state.peers).forEach(function(peerId) {
      goPeerAdded(peerId);
    });
  }
  function goOffline() {
    // Tear down all connections
    keys(state.peerConnection).forEach(function(peerId) {
      goDisconnect(peerId);
    });
    // Forget any information we think we have about connected peers
    state.peers = {};
    // 1-on-1
    state.peerId = undefined;
    // And about ourselves
    state.channel = undefined;
    state.id = undefined;
    muteUpdateButtons();
  }

  function goPeerAdded(peerId) {
    // 1-on-1 support
    if(state.peerId === undefined) {
      state.peerId = peerId;
    }
    // 1-on-1: end

    // Share current control status with peer
    emitStatus(peerId);

    // If appropriate, initiate the WebRTC connection
    if(config.self == 'master'/* TODO: Configure auto-connect per-client */) {
      goConnect(peerId);
    }
  }
  function goPeerRemoved(peerId) {
    if(peerId in state.peerConnections) {
      goDisconnect(peerId);
    }
    delete state.peers[peerId];
    // 1-on-1 support
    if(state.peerId == peerId) {
      state.peerId = undefined;
      muteUpdateButtons();
    }
    // 1-on-1: end
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
    // Detach video from stream, if it had been attached
    detachPeerStream(peerId);
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
    $('#remote-video').show();
    $('#no-remote-video').hide();
  }
  // TODO: Test well and improve this method to make sure it is
  // releasing all necessary resources.
  // Maybe extend adapter.js to make this work on all browsers?
  function detachPeerStream(peerId) {
    var videoElement = $('#remote-video')[0];
    videoElement.pause();
    $('#remote-video').hide();
    $('#no-remote-video').show();
  }


  // Show status. Isolated from main code by running in a loop
  // and intronspecting state instead of relying on being called
  // when something changes
  function renderStatus() {
    $('#status-self-connected').html(state.channel===undefined?'Disconnected':(state.id===undefined?'Connecting ...':'Connected. ID=' + state.id));
    peerKeys = keys(state.peers);
    if(peerKeys.length > 0) {
      var peerId = peerKeys[0];
      $('#status-peer-connected').html('Connected. ID='+peerId);
      var pc = state.peerConnections[peerId].pc;
      // TODO: How to figure out the connection state of the WebRTC call?
      $('#status-webrtc').html('Connecting ...');
    } else {
      $('#status-peer-connected').html('Disconnected');
      $('#status-webrtc').html('Disconnected');
    }
    setTimeout(renderStatus, 500);
  }
  renderStatus();

  // Sends the status of our controls to a peer
  function emitStatus(peerId) {
    if(state.peerId !== undefined) {
      // 1-on-1
      state.channel.emit('controls', {
        peerId: peerId,
        muted: $('#local-video')[0].muted
      });
    }
  }

  $('#reload').on('click',function(evt) {
    console.log('click');
    channel.emit('system',{ reload: true });
    window.location.reload();
  });

  // Two-way mute controls
  $('#mute-self').on('click',function(evt) {
    muteSelfToggle();
    // 1-on-1:
    emitStatus(state.peerId);
    muteUpdateButtons();
  });
  $('#mute-peer').on('click',function(evt) {
    // 1-on-1
    // Toggle our understanding of the remote muted state
    // NOTE: unset means: muted
    state.peers[state.peerId].muted = ('muted' in state.peers[state.peerId])?(!state.peers[state.peerId].muted):false;
    // Send mute request to peer
    if(state.peerId !== undefined) {
      state.channel.emit('controls', {
        peerId: state.peerId,
        muteRequest: state.peers[state.peerId].muted
      });
    }
    // Update buttons
    muteUpdateButtons();
  });

  channel.on('controls',function(message) {
    if('muteRequest' in message) {
      muteSelfToggle();
    }
    if('muted' in message) {
      state.peers[message.peerId].muted = message.muted;
    }
    muteUpdateButtons();
  });

  function muteSelfToggle() {
    var muted = $('#local-video')[0].muted;
    $('#local-video')[0].muted = !muted;
    return !muted;
  }
  function muteUpdateButtons() {
    $('#mute-self').html($('#local-video')[0].muted?'Unmute':'Mute');
    // 1-on-1
    if(state.peerId === undefined || state.channel === undefined) {
      $('#mute-peer').html('Disconnected')[0].disabled = true;
    } else {
      $('#mute-peer').html(state.peers[state.peerId].muted?'Unmute':'Mute')[0].disabled = false;
    }
    // 1-on-1: end
  }
});
