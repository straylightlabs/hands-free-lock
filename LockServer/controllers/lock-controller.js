const http = require('http');
const utils = require('./utils');

var LOCK_URL = 'http://192.168.0.3:8080/';
var SECONDS_TO_LEAVE = 1 * 60;

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
var MAC_ADDRESS_WHITELIST = new Set([
    'F0:2A:63:5C:E3:E5',  // SLBeacon00001
    'EB:B4:73:21:AC:3C',  // SLBeacon00002 -> Daniel
    'D7:AF:DA:DF:43:85',  // SLBeacon00003
]);

var presentMacAddressSet = new Set();
var leavingMacAddressSet = new Set();
var leftoverMacAddressSet = new Set();
var leavingMacAddressClearTimer;

function sendLockAction(action) {
  var url = LOCK_URL + action;
  http.get(url).on('error', function(e) {
    console.error('ERROR GET ' + url + ' ' + e.message);
  });
}
var sendUnlockAction = utils.throttle(5000, function() {
  sendLockAction('unlock');
});

function clearAfterUnlock() {
  leavingMacAddressSet.clear();
  leftoverMacAddressSet.clear();
  clearTimeout(leavingMacAddressClearTimer);
}

function unlock() {
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
    return;
  }
  if (MAC_ADDRESS_WHITELIST.has(macAddress) &&
      !leavingMacAddressSet.has(macAddress) &&
      !leftoverMacAddressSet.has(macAddress) &&
      !presentMacAddressSet.has(macAddress)) {
    console.info('UNLOCKING with BLE: ' + macAddress);
    presentMacAddressSet.add(macAddress);
    unlock();
  }
  console.info('Present IDs: ' + [...presentMacAddressSet]);
}

function processManualLock(locked) {
  if (locked) {
    console.info('MANUALLY LOCKED');

    leavingMacAddressSet = new Set(presentMacAddressSet);
    console.info('Leaving IDs: ' + [...leavingMacAddressSet]);

    clearTimeout(leavingMacAddressClearTimer);
    leavingMacAddressClearTimer = setTimeout(function() {
      leavingMacAddressSet.clear();

      leftoverMacAddressSet = new Set(presentMacAddressSet);
      console.info('Leftover IDs: ' + [...leftoverMacAddressSet]);
    }, SECONDS_TO_LEAVE * 1000);
  } else {
    console.info('MANUALLY UNLOCKED');
    clearAfterUnlock();
  }
}

function process(data) {
  console.info('RECEIVED: ' + JSON.stringify(data));
  if (data.type == 'nfc') {
    processNfc(data.url);
  } else if (data.type == 'ble') {
    processBle(data.macAddress, data.rssi);
  } else if (data.type == 'manualLock') {
    processManualLock(data.locked);
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

