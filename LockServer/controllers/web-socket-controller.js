const http = require('http');

var lastDetectionTimeMap = {};
var macAddressWhitelist = new Set([
    'CD:A5:D3:FA:A1:02',  // BLE Nano (broken?)
    'EF:B0:DA:45:8E:B8',  // TrackR
    'FD:81:9A:14:4E:ED',  // Ryo's Tile`
]);

function send(action) {
  var url = 'http://192.168.0.3:8080/' + action;
  console.info('GET ' + url);
  http.get(url).on('error', function(e) {
    console.error('ERROR GET ' + url + ' ' + e.message);
  });
}

function throttle(seconds, callback) {
  var lastExecutionTime;
  return function() {
    if (lastExecutionTime === undefined ||
        new Date().getTime() >= lastExecutionTime.getTime() + seconds) {
      callback();
      lastExecutionTime = new Date();
    }
  };
}

var getStatus = throttle(3000, function() {
  send('status');
});

var lock = throttle(10000, function() {
  send('lock');
});

var unlock = throttle(10000, function() {
  send('unlock');
});

exports.onMessage = function(message) {
  var data = JSON.parse(message);
  if (!macAddressWhitelist.has(data.macAddress)) {
    return;
  }
  console.info('RECEIVED: ' + message);
  var keepLoggedIn = false;
  if (lastDetectionTimeMap[data.macAddress] === undefined) {
    if (data.rssi > -80) {
      console.info('DETECTED: ' + data.macAddress);
      unlock();
      keepLoggedIn = true;
    } else {
      getStatus();
    }
  } else {
    keepLoggedIn = true;
  }
  if (keepLoggedIn) {
    lastDetectionTimeMap[data.macAddress] = new Date();
  }
}

exports.checkLogOut = function() {
  var newMap = {};
  var detected = false;
  for (var key in lastDetectionTimeMap) {
    if (new Date().getTime() < lastDetectionTimeMap[key].getTime() + 60000) {
      newMap[key] = lastDetectionTimeMap[key];
      detected = true;
    } else {
      console.info('LOST: ' + key);
    }
  }
  lastDetectionTimeMap = newMap;
  if (!detected) {
    lock();
  }
}

