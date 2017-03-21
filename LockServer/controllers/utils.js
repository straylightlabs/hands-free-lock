const http = require('http');
const https = require('https');

const SLACK_HOSTNAME = 'hooks.slack.com';
const SLACK_PATH = '/services/T039DEKHG/B48G32A1E/kC72f03hl5KhKNkvf42I46O4';

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

exports.get = function(url, error, timeout) {
  var req = http.get(url).on('error', error || function(err) {
    console.error('ERROR GET ' + url + ' ' + err.message);
  });
  if (timeout !== undefined) {
    req.setTimeout(timeout, function() {
      req.abort();
    });
  }
}

exports.post = function(hostname, path, data, nonsecure, error) {
  var postData = JSON.stringify(data);
  var options = {
    hostname: hostname,
    port: nonsecure ? 80 : 443,
    path: path,
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Content-Length': Buffer.byteLength(postData)
    }
  };
  var req = (nonsecure ? http : https).request(options);
  req.on('error', error || function(err) {
    console.error('ERROR POST ' + hostname + path + ' ' + err.message);
  });
  req.write(postData);
  req.end();
}

exports.notifySlack = function(data, error) {
  exports.post(SLACK_HOSTNAME, SLACK_PATH, data, false, error);
}

