const utils = require('./utils');

var LOCK_URL = 'http://192.168.0.3:8080/';
var SECONDS_TO_LEAVE = 300;

var URL_WHITELIST = new Set([
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
var MAC_ADDRESS_WHITELIST = new Map([
    //['F0:2A:63:5C:E3:E5', ['SLBeacon99998', '']],
    //['EB:B4:73:21:AC:3C', ['SLBeacon99997', '']],
    //['D7:AF:DA:DF:43:85', ['SLBeacon99999', '']],
    ['E6:64:E0:C6:40:F1', ['SLBeacon00001', 'Alisaun']],
    ['CA:5F:63:5B:17:D5', ['SLBeacon00002', 'Lauren']],
    ['D6:60:A7:9F:E5:DF', ['SLBeacon00003', 'Daniel']],
    ['C7:D7:61:92:28:85', ['SLBeacon00004', 'Roy']],
    ['EF:EA:6A:BD:C7:29', ['SLBeacon00005', 'Jake']],
    ['D5:DB:E9:EE:D8:BB', ['SLBeacon00006', 'Keigo']],
    ['E7:A1:7A:F0:41:A6', ['SLBeacon00007', 'Ikue']],
    ['D8:3E:FB:33:28:FC', ['SLBeacon00008', 'Taj']],
    ['CA:DC:C0:96:C1:A4', ['SLBeacon00009', 'Ryo']],
    // ['C2:12:FB:37:74:C6', ['SLBeacon00010', '']],
    // ['E3:DA:76:79:72:A2', ['SLBeacon00011', '']],
    // ['CD:E9:12:5F:27:42', ['SLBeacon00012', '']],
]);

var lastSeenMap = new Map();
var presentMacAddressSet = new Set();
var leavingMacAddressSet = new Set();
var leftoverMacAddressSet = new Set();
var leavingMacAddressClearTimer;
var latestJpegData;

var sendUnlockAction = utils.throttle(5000, function() {
  utils.get(LOCK_URL + 'unlock');
});

function pulseLEDs() {
  utils.get('http://192.168.0.6:8080/pulse(200,200,200,1,1)');
}

function clearAfterUnlock() {
  leavingMacAddressSet.clear();
  leftoverMacAddressSet.clear();
  clearTimeout(leavingMacAddressClearTimer);
}

function unlock() {
  sendUnlockAction();
  clearAfterUnlock();
  pulseLEDs();
}

function formatBeacon(macAddress) {
  var ownerData = MAC_ADDRESS_WHITELIST.get(macAddress);
  if (!ownerData) {
    return macAddress;
  }
  return ([macAddress].concat(ownerData)).join(' ');
}

function processNfc(url) {
  if (URL_WHITELIST.has(url)) {
    console.info('UNLOCKING with NFC: ' + url);
    unlock();
  }
}

function processBle(macAddress, rssi) {
  lastSeenMap.set(macAddress, new Date().getTime());
  if (MAC_ADDRESS_WHITELIST.has(macAddress) &&
      !leavingMacAddressSet.has(macAddress) &&
      !leftoverMacAddressSet.has(macAddress) &&
      !presentMacAddressSet.has(macAddress)) {
    console.info('UNLOCKING with BLE: ' + macAddress);
    presentMacAddressSet.add(macAddress);
    console.info('Found ' + formatBeacon(macAddress));
    logPresentMembers();
    unlock();
  }
}

setInterval(function() {
  var now = new Date().getTime();
  for (var [macAddress, lastSeen] of lastSeenMap) {
    if (lastSeen !== undefined && now - lastSeen >= 300 * 1000) {
      presentMacAddressSet.delete(macAddress);
      console.info('Lost ' + formatBeacon(macAddress));
      logPresentMembers();
      lastSeenMap.delete(macAddress);
    }
  }
}, 60 * 1000);

function logPresentMembers() {
  var presentNames = [];
  presentMacAddressSet.forEach(function(macAddress) {
    var name = MAC_ADDRESS_WHITELIST.get(macAddress)[1];
    presentNames.push(name);
  });
  console.info('Present members: ' + presentNames);
}

function processLockStateChange(state) {
  console.info('processLockStateChange: ' + state);
  if (state == 'locked') {
    console.info('LOCKED');

    leavingMacAddressSet = new Set(presentMacAddressSet);
    console.info('Leaving IDs: ' + [...leavingMacAddressSet]);

    clearTimeout(leavingMacAddressClearTimer);
    leavingMacAddressClearTimer = setTimeout(function() {
      leavingMacAddressSet.clear();

      leftoverMacAddressSet = new Set(presentMacAddressSet);
      console.info('Leftover IDs: ' + [...leftoverMacAddressSet]);
    }, SECONDS_TO_LEAVE * 1000);
  } else if (state == 'unlocked') {
    console.info('UNLOCKED');
    clearAfterUnlock();
  } else if (state == 'unreachable') {
    console.info('UNREACHABLE');
  } else {
    console.error('Unknown lock state: ' + state);
  }
}

function processImage(data) {
  latestJpegData = Buffer.from(data, 'base64');
}

function process(data) {
  if (data.type == 'nfc') {
    processNfc(data.url);
  } else if (data.type == 'ble') {
    processBle(data.macAddress, data.rssi);
  } else if (data.type == 'lockStateChange') {
    processLockStateChange(data.state);
  } else if (data.type == 'image') {
    processImage(data.data);
  } else {
    console.error('Unknown message type: ' + data.type);
  }
}

exports.post = function(req, res) {
  process(req.body);
  res.send('OK');
}

exports.socket = function(message) {
  var data = JSON.parse(message);
  process(data);
}

exports.getLatestImage = function(req, res) {
  if (!latestJpegData) {
    return res.status(404).send('Not found');
  }
  res.writeHead(200, {'Content-Type': 'image/jpeg'});
  res.end(latestJpegData);
}

