const http = require('http');
const https = require('https');

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

exports.get = function(url, error, timeout, secure) {
  const handler = secure ? https : http;
  const req = handler.get(url).on('error', error || function(err) {
    console.error('ERROR GET ' + url + ' ' + err.message);
  });
  if (timeout !== undefined) {
    req.setTimeout(timeout, function() {
      req.abort();
    });
  }
}

