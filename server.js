#!/bin/env node
/**
 * Module dependencies.
 */

var express = require('express')
  , routes = require('./routes')
  , http = require('http')
  , socketio = require('socket.io')
  , path = require('path');

var app = express();
var server = http.createServer(app);
var io = socketio.listen(server);

// all environments
app.set('ipaddress', process.env.OPENSHIFT_INTERNAL_IP || 
        process.env.OPENSHIFT_NODEJS_IP || "0.0.0.0");
app.set('port', process.env.PORT || 
        process.env.OPENSHIFT_INTERNAL_PORT || 
        process.env.OPENSHIFT_NODEJS_PORT || 3000);
app.set('views', __dirname + '/views');
app.set('view engine', 'jade');
app.use(express.favicon());
app.use(express.logger('dev'));
app.use(express.bodyParser());
app.use(express.methodOverride());
app.use(app.router);
app.use(express.static(path.join(__dirname, 'public')));

// development only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

app.get('/wg', routes.slave);
app.get('/ar', routes.master);

app.get('/', routes.participant);
app.get('/office', routes.office);

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

server.listen(app.get('port'), app.get('ipaddress'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

