
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

var maker;
var makerIceCandidates = [];
var makerSdp;
var audience = [];  // Array of { name: , socket: , sdp: , candidates: }

io.sockets.on('connection', function(socket) {
  socket.on('maker',function() {
    if(maker === undefined) {
      maker = socket;
    }
    if(audience.length > 0) {
      socket.emit('audience all', audience.map(function(entry) { return entry.name; }));
    }
  });
  socket.on('audience', function(name) {
    console.log('New watcher: ' + name);
    audience.push({ name: name, socket: socket });
    if( maker) {
      maker.emit('audience add', name);
    }
    if(makerSdp) {
      socket.emit('webrtc sdp', makerSdp);
    }
    if(makerIceCandidates.length > 0) {
      socket.emit('webrtc candidates', makerIceCandidates);
    }
  });
  socket.on('disconnect', function() {
    if(socket == maker) {
      maker = undefined;
      audience.forEach(function(entry){ entry.socket.emit('maker left'); });
    } else {
      var left = audience.filter(function(entry, ix) { if(entry.socket == socket) { return audience.splice(ix,1); } });
      if(left.length > 0 && maker !== undefined) {
        console.log(left[0].name + ' left');
        maker.emit('audience del', left[0].name);
      }
    }
  });

  // WebRTC
  socket.on('webrtc candidate', function(candidate) {
    if(socket == maker) {
      makerIceCandidates.push(candidate);
      audience.forEach(function(entry){ entry.socket.emit('webrtc candidate', candidate); });
    } else {
      var audienceEntry = audience.filter(function(entry) { return (entry.socket == socket); });
      if( audienceEntry.length > 0) {
        if( ! audienceEntry.candidates) { audienceEntry.candidates = []; }
        audienceEntry.candidates.push(candidate);
        if(maker) {
          maker.emit('webrtc candidate', candidate);
        }
      }
   }
  });
  socket.on('webrtc sdp', function(sdp) {
    if(socket == maker) {
      makerSdp = sdp
      audience.forEach(function(entry){ entry.socket.emit('webrtc sdp', sdp); });
    } else {
      var audienceEntry = audience.filter(function(entry) { return (entry.socket == socket); });
      if( audienceEntry.length > 0) {
        audienceEntry.sdp = sdp;
        if(maker) {
          maker.emit('webrtc sdp', sdp);
        }
      }
    }
  });
});

server.listen(app.get('port'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

