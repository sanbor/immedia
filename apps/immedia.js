/****
 * Immedia: office + remote awareness tool, inspired by Sqwiggle
 */
module.exports = function(app, io) {

  var rooms = {};
  app.get('/', function(req, res) {
    res.redirect('/r/default');
  });
  app.get('/r/:room_name', function(req, res) {
    var roomName = req.params.room_name;
    var roomPassword = req.query.password || false;
    console.log('got request for room ' + roomName + ', password ' + roomPassword);
    if(!(roomName in rooms)) {
      console.log('creating room "' + roomName + '"' + (roomPassword ? ' with password.' : ''));
      var newRoom = {
        name: roomName,
        password: roomPassword
      };
      startRoom(newRoom);
      rooms[roomName] = newRoom;
    }
    res.render('immedia/main');
  });

  function startRoom(room) {
    var o = io.of('/'+room.name);
    if(room.password) {
      o = o.authorization(function (handshakeData, callback) {
        console.dir(handshakeData);
        if(handshakeData.query.password && handshakeData.query.password == room.password) {
          callback(null, true);
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
