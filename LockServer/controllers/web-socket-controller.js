const http = require('http');

var urlWhitelist = new Set([
    'https://straylight.jp/one/00001',
    'https://straylight.jp/one/00002',
    'https://straylight.jp/one/vk2g7',
    'https://straylight.jp/one/b4cz6',
    'https://straylight.jp/one/6ej7n',
    'https://straylight.jp/one/u36bx',
    'https://straylight.jp/one/9y2tk',
    'https://straylight.jp/one/33fxm',
    'https://straylight.jp/one/ujv3w',
    'https://straylight.jp/one/zz6n7',
]);
var macAddressWhitelist = new Set([
    'F0:2A;63:5C;E3:E5',  // SLBeacon00001
    'EB:B4:73:21:AC:3C',  // SLBeacon00002
    'D7:AF:DA:DF:43:85',  // SLBeacon00003
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

var unlock = throttle(2000, function() {
  send('unlock');
});

exports.onMessage = function(message) {
  console.info('RECEIVED: ' + message);
  var data = JSON.parse(message);
  if (data.type == 'nfc') {
    authorizeNfc(data.url);
  } else if (data.type == 'ble') {
    authorizeBle(data.macAddress, data.rssi);
  } else {
    console.error('Unknown message type: ' + data.type);
  }
}

function authorizeNfc(url) {
  if (urlWhitelist.has(url)) {
    unlock();
  }
}

function authorizeBle(macAddress, rssi) {
  if (macAddressWhitelist.has(macAddress) && rssi > -90) {
    unlock();
  }
}

