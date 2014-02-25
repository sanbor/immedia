angular.module('app', ['ngSanitize']).
controller('WebcamControl',['$scope', '$sce', function($scope, $sce) {
  // --------------------------------------------------------
  // Angular bound variables
  // --------------------------------------------------------
  // Display
  $scope.status = 'Starting'
  $scope.messages = [];             // Messages rendered in chat list
  $scope.when = undefined;          // Displays timestamp using moment.js
  $scope.participants = undefined;  // List of people active in the chat
  $scope.isError = false;           // There was an error, show retry button
  // Input
  $scope.inputText = undefined;     // chat box text input
  $scope.roomPassword = undefined;  // input for room password
  // Events
  $scope.connect = undefined;       // Try connecting again
  $scope.sendMessage = undefined;   // Send message clicked
  $scope.keyup = undefined;         // Detect submit via Enter key on textarea
  $scope.snoozeVideo = undefined;   // Let go of Webcam for a little while

  // Internal / status / private variables
  var stream;  // Webcam stream
  var socket;  // socket.io connection
  var canvas = $('#self')[0];  // canvas on which snapshots are being drawn
  var participantMap = {};  // Map of participants, keyed by ID
    // each participant entry will have fields 'image', 'timestamp'
  var snapshotIntervalId;
  var socketioIntervalId;  // Timer to send snapshot image / keepalive to the room

  var snoozed = false;

  var alertMode = "quiet";

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
    // Gather webcamshot to send with message
    var URL = canvas.toDataURL();

    // Emit message through socket.io
    var msg = {
      timestamp: new Date().getTime(),
      text: $scope.inputText,
      image: URL
    };
    $('textarea').val('');
    $scope.inputText = "";
    socket.emit('message', msg);

    // Add it to the list locally
    addMessage(msg, true);
  }
  // Hack to get the thing to also submit when you press Enter on the textarea
  $scope.keyup = function(ev) {
    if(ev && ev.keyCode == 13) {
      $scope.sendMessage();
    }
  };

    /**
   * Triggered by clicking on the different alert modes
   */
  $scope.setAlertMode = function(mode) {
    alertMode = mode;
  };

  /**
   * Release the camera for some time and then automatically try to
   * grab it again
   */
  $scope.snoozeVideo = function() {
    var releaseTime = 10000;
    var retryInterval = 2000;

    // Tries to regain control of the Webcam. Keeps retrying.
    // TODO: Generalize with startWebcam below
    function tryWebcam() {
      getUserMedia({ video: true },
        function(localStream) {
          stream = localStream;
          attachMediaStream($('video')[0], stream);
          snoozed = false;
        }, function(err) {
          setTimeout(tryWebcam, retryInterval);
        });
    }
    if(stream) {
      snoozed = true;
      // Release Webcam
      stream.stop();

      // Add snooze icon over person's image
      // TODO: Calculate position based on canvas and icon size
      canvas.getContext('2d').drawImage($('#snooze')[0], 20, 5);

      // Regain Webcam after snooze interval
      setTimeout(tryWebcam, releaseTime);
    }
  };

  /**
   * Manually connect. User clicked 'connect' button
   */
  $scope.connect = function() {
    console.log('connect');
    startSocketIO();
  };

  $scope.when = function(timestamp) {
    return moment(timestamp).fromNow();
  };

  $scope.setHtmlToTrusted = function(html_code)
  {
    return $sce.trustAsHtml(html_code);
  };

  /**
   * Adds the message to the data model (which is in turn automatically rendered
   * through Angular.js bindings)
   */
  function addMessage(msg, sendByCurrentUser) {
    // Insert the new message to the top of the list of messages
    $scope.messages.splice(0, 0, msg);
    // Crop the list of in-memory (and rendered) messages to a fixed maximum size
    var max_rows = 40; // Max number of rows hardcoded here
    if($scope.messages.length > max_rows) {
      $scope.messages.splice(max_rows,$scope.messages.length - max_rows);
    }

    if(alertMode != "silent" && !sendByCurrentUser) {
      if(alertMode == "quiet") {
        var audio = new Audio('/audio/quiet.mp3');
      } else {
        var alarmId = getRandomInt(1,100);

        if(alarmId <70) {
          var audio = new Audio('/audio/audio1.mp3');
        } else if (alarmId <85) {
          var audio = new Audio('/audio/audio2.mp3');
        } else if (alarmId <95) {
          var audio = new Audio('/audio/audio3.mp3');
        } else {
          var audio = new Audio('/audio/audio4.mp3');
        }
      }

      audio.play();
    }
  }

  function getRandomInt (min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function startWebcam() {
    // Start the process to get the Webcam
    // getUserMedia({ audio: true, video: true },
    getUserMedia({ video: true },
      function(localStream) {
        $scope.status = 'Got user media';
        $scope.$digest();
        stream = localStream;
        attachMediaStream($('video')[0], stream);
        startSnapshots();
        startSocketIO();
      }, function(err) {
        $scope.status = 'Error getting user media: ' + err;
        $scope.$digest();
      });
  }
  function startSocketIO() {
    // Extract room name from URL, keep the '/'
    var ix = window.location.href.lastIndexOf('/');
    var roomName = window.location.href.substring(ix);

    if(!$.isEmptyObject(io.sockets)) {
      // JAC: what a horrible hack
      io.sockets = {};
    }

    if($scope.roomPassword) {
      socket = io.connect(roomName, { query: 'password=' + $scope.roomPassword });
    } else {
      socket = io.connect(roomName);
    }
    var s = socket.socket;
    socket.on('connect', function() {
      startRoomInterval(socket);
      $scope.status = 'Socket.IO connected';
      $scope.isError = false;
      $scope.$digest();
    });
    // Receives updates of old messages from the server
    // TODO: Better idea: have client request messages newer
    // than the latest one it has (or all if it has none)
    socket.on('messages', function(messages) {
      $scope.messages = messages;
      $scope.$digest();
    });
    socket.on('error', function(reason) {
      stopRoomInterval(socket);
      $scope.status = 'Socket.IO error: ' + reason;
      $scope.isError = true;
      $scope.$digest();
    });
    socket.on('message', function(msg) {
      addMessage(msg, false);
      $scope.$digest();
    });
    socket.on('update', function(msg) {
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
  }

  function startRoomInterval(socket) {
    stopRoomInterval();
    socketioIntervalId = setInterval(function() {
      socket.emit('update',{
        image: canvas.toDataURL(),
        timestamp: new Date().getTime()
      });
    }, 5000);
  }

  function stopRoomInterval() {
    if(socketioIntervalId) {
      clearInterval(socketioIntervalId);
      socketioIntervalId = false;
    }
  }

  function startSnapshots() {
    var context = canvas.getContext('2d');
    var video = $('video')[0];
    stopSnapshots();
    snapshotIntervalId = setInterval(function() {
      // Avoid redrawing if we're in snooze mode so we don't overwrite
      // the cute snooze icon
      if(snoozed) {
        return;
      }
      var crop = 25;
      context.drawImage(video, 160, 120, 360, 240,
                       0, 0, canvas.clientWidth, canvas.clientHeight);
      $('#copy')[0].getContext('2d').drawImage(video, 0, 0,
                       canvas.clientWidth, canvas.clientHeight);
    }, 1000);
  }
  function stopSnapshots() {
    if(snapshotIntervalId) {
      clearInterval(snapshotIntervalId);
      snapshotIntervalId = false;
    }
  }

  startWebcam();
}]);
