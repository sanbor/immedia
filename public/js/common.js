function WebcamControl($scope) {
  // --------------------------------------------------------
  // Angular bound variables
  // --------------------------------------------------------
  // Display
  $scope.status = 'Starting'
  $scope.messages = [];  // Messages rendered in chat list
  // Input
  $scope.inputText = undefined; // chat box text input
  // Events
  $scope.sendMessage = undefined; // Send message clicked


  // Internal / status / private variables
  var stream;  // Webcam stream
  var socket;  // socket.io connection
  var canvas = $('#self')[0];  // canvas on which snapshots are being drawn


  /* Quick sample / exercise on how to update on external events
  var i=0;
  setInterval(function() {
    $scope.status = 'Idle ' + i++;
    $scope.$digest();
    *//*
    $scope.$apply(function() {
      $scope.status = 'Idle ' + i;
    });
   *//*
  }, 1000);
  */

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

  function addMessage(msg) {
    $scope.messages.push(msg);
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
  }

  function startSnapshots() {
    var context = canvas.getContext('2d');
    attachMediaStream($('video')[0], stream);
    setInterval(function() {
      context.drawImage($('video')[0], 0, 0, canvas.clientWidth, canvas.clientHeight);
    }, 1000);
  }

  startWebcam();
  startSocketIO();
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
