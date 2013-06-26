$(function() {
  console.log("Starting Maker component");

  // Open socket.io channel and Webcam capture
  var channel = io.connect();
  channel.on('connect', function() {
    channel.emit('maker');
  });

  // Show webcam on local element
  getUserMedia({audio: true, video: true}, function(stream) {
    attachMediaStream($('#local-video')[0], stream);
  });

  // When new users connect (notified via socket.io)
  // start broadcasting to them
});
