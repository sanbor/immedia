function WebcamControl($scope) {
  $scope.status = 'Idle 0';
  var i=0;
  setInterval(function() {
    $scope.status = 'Idle ' + i++;
    $scope.$digest();
    /*
    $scope.$apply(function() {
      $scope.status = 'Idle ' + i;
    });
   */
  }, 1000);
}
