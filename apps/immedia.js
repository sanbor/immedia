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
    if(!(roomName in rooms)) {
      startRoom(roomName);
      rooms[roomName] = true;
    }
    res.render('immedia/main');
  });

  function startRoom(roomName) {
    console.log('creating namespace: ' + roomName);
    io.of('/'+roomName).
      on('connection', function(socket) {
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
