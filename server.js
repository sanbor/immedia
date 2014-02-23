#!/usr/bin/env node
/**
 * This is the main server entry point. In here we do general environment configuration
 * but not much more. The rest (main application logic) we separate in individual
 * application files loaded below
 */


var express = require('express'),
  http = require('http'),
  socketio = require('socket.io'),
  path = require('path'),
  mongoose = require('mongoose');

// Initialize express and Socket.IO
var app = express();
var server = http.createServer(app);
var io = socketio.listen(server);

// Configure Socket.IO
io.set('log level', 1);

// Configure for all environments
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

// Configure mongoose
var uristring =
  process.env.MONGOLAB_URI ||
  process.env.MONGOHQ_URL ||
  'mongodb://localhost/immedia';

// Error handler for development environment only
if ('development' == app.get('env')) {
  app.use(express.errorHandler());
}

// Start listening
server.listen(app.get('port'), app.get('ipaddress'), function(){
  console.log('Express server listening on port ' + app.get('port'));
});

// Connect to mongoose
mongoose.connect(uristring, function(err, res) {
  if(err) console.error('Error connecting to MongoDB on ' + uristring + ': ' + err);
  else    console.log('Connected to MongoDB on ' + uristring);
});

// Application entry points

// Wormhole (currently disabled)
// var wh = require('./apps/wormhole.js')(app, io);

// Immedia
var im = require('./apps/immedia.js')(app, io);
