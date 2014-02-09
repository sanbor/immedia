function WebcamControl($scope) {
  // --------------------------------------------------------
  // Angular bound variables
  // --------------------------------------------------------
  // Display
  $scope.status = 'Starting'
  $scope.messages = [];  // Messages rendered in chat list
  $scope.when = undefined; // Displays timestamp using moment.js
  $scope.participants = undefined; // List of people active in the chat
  // Input
  $scope.inputText = undefined; // chat box text input
  // Events
  $scope.sendMessage = undefined; // Send message clicked


  // Internal / status / private variables
  var stream;  // Webcam stream
  var socket;  // socket.io connection
  var canvas = $('#self')[0];  // canvas on which snapshots are being drawn
  var participantMap = {};  // Map of participants, keyed by ID
    // each participant entry will have fields 'image', 'timestamp'

  $scope.participants = function() {
    ret = [];
    for(var id in participantMap) {
      ret.push(participantMap[id]);
    }
    return ret;
  };

  /**
   * Triggered by clicking on the 'send' button
   */
  $scope.sendMessage = function() {
    console.log('will send message: ' + $scope.inputText);

    // Gather webcamshot to send with message
    var URL = canvas.toDataURL();
    console.log('image is now: ' + URL);

    // Emit message through socket.io
    var msg = {
      timestamp: new Date().getTime(),
      text: $scope.inputText,
      image: URL
    };
    socket.emit('message', msg);

    // Add it to the list locally
    addMessage(msg);
  }
  // Hack to get the thing to also submit when you press Enter on the textarea
  $scope.keyup = function(ev) {
    if(ev && ev.keyCode == 13) {
      $scope.sendMessage();
      $('textarea').val('');
    }
  };

  $scope.when = function(timestamp) {
    return moment(timestamp).fromNow();
  };

  /**
   * Adds the message to the data model (which is in turn automatically rendered
   * through Angular.js bindings)
   */
  function addMessage(msg) {
    // Insert the new message to the top of the list of messages
    $scope.messages.splice(0, 0, msg);
    // Crop the list of in-memory (and rendered) messages to a fixed maximum size
    var max_rows = 40; // Max number of rows hardcoded here
    if($scope.messages.length > max_rows) {
      $scope.messages.splice(max_rows,$scope.messages.length - max_rows);
    }
  }

  function startWebcam() {
    // Start the process to get the Webcam
    // getUserMedia({ audio: true, video: true },
    getUserMedia({ video: true },
      function(localStream) {
        $scope.status = 'Got user media';
        $scope.$digest();
        stream = localStream;
        startSnapshots();
        startSocketIO();
      }, function(err) {
        $scope.status = 'Error getting user media: ' + err;
        $scope.$digest();
      });
  }
  function startSocketIO() {
    socket = io.connect('/facechat');
    socket.on('connect', function() {
      $scope.status = 'Socket.IO connected';
      $scope.$digest();
    });
    socket.on('ready', function() {
      $scope.status = 'Socket.IO ready';
      $scope.$digest();
    });
    socket.on('message', function(msg) {
      addMessage(msg);
      $scope.$digest();
    });
    socket.on('update', function(msg) {
      console.log('got update');
      if(!(msg.id in participantMap)) {
        participantMap[msg.id] = {};
      }
      participantMap[msg.id].image = msg.image;
      participantMap[msg.id].timestamp = msg.timestamp;
      $scope.$digest();
    });
    socket.on('exit', function(msg) {
      if(msg.id in participantMap) {
        delete participantMap[msg.id];
      }
      $scope.$digest();
    });
    setInterval(function() {
      socket.emit('update',{
        image: canvas.toDataURL(),
        timestamp: new Date().getTime()
      });
    }, 5000);
  }

  function startSnapshots() {
    var context = canvas.getContext('2d');
    attachMediaStream($('video')[0], stream);
    setInterval(function() {
      context.drawImage($('video')[0], 0, 0, canvas.clientWidth, canvas.clientHeight);
    }, 1000);
  }

  startWebcam();
}

// Hack to force submit on enter for the input textarea
/*
$(function(){
  $('form > textarea').on('keyup', function(e){
    if (e.keyCode == 13) {
      // do whatever you want to do, for example submit form
      $(this).parent('form').trigger('submit');
    }
  });
});
*/
