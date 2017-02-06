const http = require('http');

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

exports.get = function(url) {
  http.get(url).on('error', function(e) {
    console.error('ERROR GET ' + url + ' ' + e.message);
  });
}

