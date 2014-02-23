var models = require('./../models');

/****
 * Immedia: office + remote awareness tool, inspired by Sqwiggle
 */
module.exports = function(app, io) {

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
          room.password = roomPassword;
        }
        room.save();
      } else {
        room = results[0];
      }
      startRoom(room);
      res.render('immedia/main');
    });
  });

  function startRoom(room) {
    var o = io.of('/'+room.name);
    if(room.password) {
      o = o.authorization(function (handshakeData, callback) {
        if(handshakeData.query.password && handshakeData.query.password == room.password) {
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
