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
    ['F0:2A:63:5C:E3:E5', 'Ryo'],
    ['EB:B4:73:21:AC:3C', 'Daniel'],
    ['D7:AF:DA:DF:43:85', 'Taj'],
]);

var presentMacAddressSet = new Set();
var leavingMacAddressSet = new Set();
var leftoverMacAddressSet = new Set();
var leavingMacAddressClearTimer;
var showOffColorTimer;

var sendUnlockAction = utils.throttle(5000, function() {
  utils.get(LOCK_URL + 'unlock');
});

function sendShowOffColor() {
  utils.get('http://192.168.0.6:8080/000,000,000');
}

function sendShowUnlockingColor() {
  utils.get('http://192.168.0.6:8080/050,050,255');
  clearTimeout(showOffColorTimer);
  showOffColorTimer = setTimeout(sendShowOffColor, 3000);
}

function sendShowUnlockedColor() {
  utils.get('http://192.168.0.6:8080/050,255,050');
  clearTimeout(showOffColorTimer);
  showOffColorTimer = setTimeout(sendShowOffColor, 3000);
}

function clearAfterUnlock() {
  leavingMacAddressSet.clear();
  leftoverMacAddressSet.clear();
  clearTimeout(leavingMacAddressClearTimer);
}

function unlock() {
  sendShowUnlockingColor();
  sendUnlockAction();
  clearAfterUnlock();
}

function processNfc(url) {
  if (URL_WHITELIST.has(url)) {
    console.info('UNLOCKING with NFC: ' + url);
    unlock();
  }
}

function processBle(macAddress, rssi) {
  if (rssi >= 0) {
    presentMacAddressSet.delete(macAddress);
    logPresentMembers();
  } else if (MAC_ADDRESS_WHITELIST.has(macAddress) &&
             !leavingMacAddressSet.has(macAddress) &&
             !leftoverMacAddressSet.has(macAddress) &&
             !presentMacAddressSet.has(macAddress)) {
    console.info('UNLOCKING with BLE: ' + macAddress);
    presentMacAddressSet.add(macAddress);
    logPresentMembers();
    unlock();
  }
}

function logPresentMembers() {
  var presentNames = [];
  presentMacAddressSet.forEach(function(macAddress) {
    var name = MAC_ADDRESS_WHITELIST.get(macAddress);
    presentNames.push(name);
  });
  console.info('Present members: ' + presentNames);
}

function processLockStateChange(state) {
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
    sendShowUnlockedColor();
    clearAfterUnlock();
  } else if (state == 'unreachable') {
    console.info('UNREACHABLE');
  } else {
    console.error('Unknown lock state: ' + state);
  }
}

function process(data) {
  console.info('RECEIVED: ' + JSON.stringify(data));
  if (data.type == 'nfc') {
    processNfc(data.url);
  } else if (data.type == 'ble') {
    processBle(data.macAddress, data.rssi);
  } else if (data.type == 'lockStateChange') {
    processLockStateChange(data.state);
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

