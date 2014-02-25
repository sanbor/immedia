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
      socket.on('message', function(msg) {
        console.log('Message through. Image size = ', msg && msg.image && msg.image.length);
        socket.broadcast.emit('message', msg);
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
