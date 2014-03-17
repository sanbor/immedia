var models = require('./../models');
var crypto = require('crypto');
var moniker = require('moniker');

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
    res.redirect('/r/' + moniker.choose());
  });
  app.get('/r/:room_name', function(req, res) {
    // When running on Heroku, always redirect HTTP requests to HTTPS so that we can remember
    // webcam permission settings
    if('production' == app.get('env')) {
      if(req.headers['x-forwarded-proto'] != 'https') {
        res.redirect('https://immedia.herokuapp.com' + req.url);
      }
    }

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
      // Upon client request, emit older messages for this room
      // params: {
      //   newerThan: timestamp   // Only fetch messages newer than this
      // }
      socket.on('request-messages', function(params) {
        var query = models.Message.find({ roomId: room._id }, { roomId: 0 });
        if(params && 'newerThan' in params) {
          query = query.find({ timestamp: { $gt: params.newerThan }});
        }
        query.
          sort('-timestamp').
          limit(40).    // Don't return more than 40 messages to the client. It will only render
                        // these many anyway
          exec(function(err, result) {
          if(err) console.error('Error looking for old messges in room ' + room.name);
          else {
            socket.emit('messages', result);
          }
        });
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
        // Cap the maximum number of messages stored
        purgeMessages(room);
      });
      socket.on('nickname', function(msg) {
        msg.id = socket.id;
        socket.broadcast.emit('nickname', msg);
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

  // Deletes from the database any messages older than allowed by the room configuration
  function purgeMessages(room) {
    var oldestTimestampAllowed = new Date().getTime() - room.max_message_age;
    models.Message.remove({ roomId: room._id, timestamp: { $lt: oldestTimestampAllowed }},
      function(err) {
        if(err) console.error('Error trimming documents for room ' + room.name + ':', err);
      });
  }
}
