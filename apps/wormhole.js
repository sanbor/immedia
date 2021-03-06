/***
 * Old Wormhole (WebRTC site-to-site tunnel) functionality
 *
 * Left here only for reference (although it still works just fine)
 */
module.exports = function(app, io) {
  app.get('/wg', function(req, res) {
    res.render('wormhole/slave');
  });
  app.get('/ar', function(req, res) {
    res.render('wormhole/master');
  });

  /**
   * State is handled as follows:
   * - In the 'globalState' variable below, comprised of the next available
   *   ID to give a peer and a dictionary of peer 'state' objects, keyed
   *   by peer ID.
   * - Each 'state' object has:
   *   - type: ['master' or 'slave' or whatever]
   *   - id: the peer ID
   *   - socket: link to the socket.io socket object
   * - The 'state' object is also set to the socket as its 'state' propery
   */
  var globalState = {
    nextId: 1,
    peers: {}
  };

  // TODO: Find what is the best way to do this on Node JS
  function keys(anObject) {
    var keys = [];
    for(var key in anObject) {
      keys.push(key);
    }
    return keys;
  }

  function createPeer(socket, role) {
    // A new peer is registering
    // 1- Allocate an ID and send back to client
    var newPeerId = role + ":" + globalState.nextId++;
    state = {
      type: role,
      id: newPeerId,
      socket: socket
    };
    console.log('Creating new peer: ' + newPeerId);
    // TODO: Maybe replace by returning data via ACK
    socket.emit('id', newPeerId);

    // 2- Send current list of peers
    // TODO: Use broadcast instead
    socket.emit('peer', {'add': keys(globalState.peers) });

    // 3- Notify other peers of this new client
    for(var peerId in globalState.peers) {
      globalState.peers[peerId].socket.emit('peer', {'add': [newPeerId] });
    }

    // 4- Save this new peer in our globalState and in the socket
    globalState.peers[newPeerId] = state;
    socket.state = state;
  }

  io.sockets.on('connection', function(socket) {
    socket.on('master',function() {
      createPeer(socket, 'master');
    });
    socket.on('slave', function(name) {
      createPeer(socket, 'slave');
    });
    socket.on('disconnect', function() {
      if(!socket.state)
        // It never even registered as slave or master
        // e.g. fast reload
        return;
      delete globalState.peers[socket.state.id];
      for(var peerId in globalState.peers) {
        globalState.peers[peerId].socket.emit('peer', {'del': [socket.state.id] });
      }
    });

    socket.on('system', function(message) {
      socket.broadcast.emit('system',message);
    });

    function pairPeerEvent(eventName) {
      socket.on(eventName, function(payload) {
        var peerSocket = globalState.peers[payload.peerId];
        // Change the ID in peerId to be the sender instead of
        // the recipient, which is what comes in on the message
        payload.peerId = socket.state.id;
        peerSocket.socket.emit(eventName, payload);
      });
    }
    pairPeerEvent('webrtc');
    pairPeerEvent('controls');
  });
}
