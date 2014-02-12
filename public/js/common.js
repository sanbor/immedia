angular.module('app', ['ngSanitize']).
controller('WebcamControl',['$scope', '$sce', function($scope, $sce) {
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
  $scope.keyup = undefined;  // Detect submit via Enter key on textarea
  $scope.snoozeVideo = undefined; // Let go of Webcam for a little while

  // Internal / status / private variables
  var stream;  // Webcam stream
  var socket;  // socket.io connection
  var canvas = $('#self')[0];  // canvas on which snapshots are being drawn
  var participantMap = {};  // Map of participants, keyed by ID
    // each participant entry will have fields 'image', 'timestamp'

  var snoozed = false;

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

    // socket = io.connect('/facechat');
    socket = io.connect(roomName);
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
    var video = $('video')[0];
    setInterval(function() {
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

  startWebcam();
}]);
