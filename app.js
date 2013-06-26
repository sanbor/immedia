
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
app.set('port', process.env.PORT || 3000);
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

app.get('/', routes.index);
app.get('/maker', routes.maker);

io.sockets.on('connection', function(socket) {
  console.log('client connected');
  socket.on('maker',function() {
    console.log('Maker is online!');
  });
  socket.on('disconnect', function() {
    console.log('Maker is offline');
  });
});

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

