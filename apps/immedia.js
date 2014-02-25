var models = require('./../models');
var crypto = require('crypto');

// Shortcut for producint an MD5 hash out of a password string
function hash(password) {
  return crypto.createHash('md5').update(password).digest('hex');
}

/****
 * Immedia: office + remote awareness tool, inspired by Sqwiggle
 */
module.exports = function(app, io) {
  // Keep track of which rooms have already open for socket.io
  var startedRooms = {};

  app.get('/', function(req, res) {
    res.redirect('/r/default');
  });
  app.get('/r/:room_name', function(req, res) {
    var roomName = req.params.room_name;
    var roomPassword = req.query.password || false;
    models.Room.find({ name: roomName }).exec(function(err, results) {
      // TODO: Error handling
      var room;
      if(results.length == 0) {
        console.log('creating room "' + roomName + '"' + (roomPassword ? ' with password.' : ''));
        var room = new models.Room({
          name: roomName
        });
        if(roomPassword) {
          room.password = hash(roomPassword);
        }
        room.save();
      } else {
        room = results[0];
      }
      if(!(room.name in startedRooms)) {
        console.log('Starting room ' + room.name);
        startRoom(room);
        startedRooms[room.name] = true;
      }
      res.render('immedia/main');
    });
  });

  function startRoom(room) {
    var o = io.of('/'+room.name);
    if(room.password) {
      o = o.authorization(function (handshakeData, callback) {
        if(handshakeData.query.password && hash(handshakeData.query.password) == room.password) {
          callback(null, true);
          console.log('User admitted into protected room: ' + room.name);
        } else {
          callback("Wrong room password", false);
        }
      });
    }
    o.on('connection', function(socket) {
      // Emit older messages for this room
      // TODO: Limit how many messages are being sent
      models.Message.find({ roomId: room._id }, { roomId: 0 }).exec(function(err, result) {
        if(err) console.error('Error looking for old messges in room ' + room.name);
        else {
          socket.emit('messages', result);
        }
      });

      // Received when a participant sends a messages
      socket.on('message', function(msg) {
        console.log('Message through. Image size = ', msg && msg.image && msg.image.length);
        // Broadcast the message to the rest of the participants
        socket.broadcast.emit('message', msg);
        // Store the message in persistent storage
        var messageObject = new models.Message(msg);
        messageObject.roomId = room._id;
        messageObject.save();
        // TODO: Cap the maximum number of messages stored
      });

      socket.on('update', function(msg) {
        msg.id = socket.id;
        socket.broadcast.emit('update', msg);
      });
      socket.on('disconnect', function() {
        socket.broadcast.emit('exit', { id: socket.id });
      });
    });
  }
}
