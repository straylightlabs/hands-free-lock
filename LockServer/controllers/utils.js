exports.throttle = function(seconds, callback) {
  var lastExecutionTime;
  return function() {
    if (lastExecutionTime === undefined ||
        new Date().getTime() >= lastExecutionTime.getTime() + seconds) {
      callback();
      lastExecutionTime = new Date();
    }
  };
}

