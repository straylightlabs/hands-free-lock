const utils = require('./utils');

var LOCK_URL = 'http://192.168.0.3:8080';
var LED_URL = 'http://192.168.0.6:8080';
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
    ['E6:64:E0:C6:40:F1', ['SLBeacon00001', 'Alisaun', [182, 255, 0]]],
    ['CA:5F:63:5B:17:D5', ['SLBeacon00002', 'Lauren',  [225, 0,   255]]],
    ['D6:60:A7:9F:E5:DF', ['SLBeacon00003', 'Daniel',  [255, 255, 255]]],
    ['C7:D7:61:92:28:85', ['SLBeacon00004', 'Roy',     [255, 255, 255]]],
    ['EF:EA:6A:BD:C7:29', ['SLBeacon00005', 'Jake',    [255, 255, 255]]],
    ['D5:DB:E9:EE:D8:BB', ['SLBeacon00006', 'Keigo',   [255, 255, 255]]],
    ['E7:A1:7A:F0:41:A6', ['SLBeacon00007', 'Ikue',    [255, 255, 255]]],
    ['D8:3E:FB:33:28:FC', ['SLBeacon00008', 'Taj',     [0,   135, 255]]],
    ['CA:DC:C0:96:C1:A4', ['SLBeacon00009', 'Ryo',     [255, 102, 0]]],
    // ['C2:12:FB:37:74:C6', ['SLBeacon00010', '', [255, 255, 255]]],
    // ['E3:DA:76:79:72:A2', ['SLBeacon00011', '', [255, 255, 255]]],
    // ['CD:E9:12:5F:27:42', ['SLBeacon00012', '', [255, 255, 255]]],
]);

var lastSeenMap = new Map();
var presentMacAddressSet = new Set();
var leavingMacAddressSet = new Set();
var leftoverMacAddressSet = new Set();
var leavingMacAddressClearTimer;
var latestJpegData;
var indoorScannerLastHealthyTime = new Date();
var outdoorScannerLastHealthyTime = new Date();

var sendUnlockAction = utils.throttle(5000, function() {
  utils.get(LOCK_URL + '/unlock');
});

function showRainbowLEDPattern() {
  utils.get(LED_URL + '/rainbow()');
}

function showPulseLEDPattern() {
  utils.get(LED_URL + '/pulse(50,255,120,0.5,1)');
}

var setBaseLEDColorTimer = null;
function setBaseLEDColor(macAddress) {
  clearTimeout(setBaseLEDColorTimer);

  var data = MAC_ADDRESS_WHITELIST.get(macAddress);
  if (!data || !data[2] || data[2].length != 3) {
    utils.get(LED_URL + '/set_flicker(255,255,255)');
    return;
  }
  utils.get(LED_URL + '/set_flicker(' + data[2].join(',') + ')');

  setBaseLEDColorTimer = setTimeout(setBaseLEDColor, 60 * 1000);
}

function notify(text) {
  console.info(text);
  utils.notifySlack({
    channel: '#alerts',
    text: text,
    username: 'Logger'
  });
}

function clearAfterUnlock() {
  leavingMacAddressSet.clear();
  leftoverMacAddressSet.clear();
  clearTimeout(leavingMacAddressClearTimer);
}

function unlock() {
  sendUnlockAction();
  clearAfterUnlock();
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
    showPulseLEDPattern();
    unlock();
  }
}

function processBle(macAddress, rssi) {
  if (!MAC_ADDRESS_WHITELIST.has(macAddress)) {
    return;
  }
  lastSeenMap.set(macAddress, new Date().getTime());
  if (!leavingMacAddressSet.has(macAddress) &&
      !leftoverMacAddressSet.has(macAddress) &&
      !presentMacAddressSet.has(macAddress)) {
    presentMacAddressSet.add(macAddress);
    logFoundBeacon(macAddress);
    setBaseLEDColor(macAddress);
    unlock();
  }
}

setInterval(function() {
  var now = new Date().getTime();
  for (var [macAddress, lastSeen] of lastSeenMap) {
    if (lastSeen !== undefined && now - lastSeen >= 60 * 1000) {
      presentMacAddressSet.delete(macAddress);
      lastSeenMap.delete(macAddress);
      logLostBeacon(macAddress);
    }
  }
}, 60 * 1000);

function getOwner(macAddress) {
  return MAC_ADDRESS_WHITELIST.has(macAddress)
      ? MAC_ADDRESS_WHITELIST.get(macAddress)[1]
      : 'Unknown Person';
}

function getPresentBeaconOwners() {
  function joinPhrases(arr) {
    if (arr.length == 0) {
      return '';
    }
    if (arr.length == 1) {
      return arr[0];
    }
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }

  var presentOwners = [];
  presentMacAddressSet.forEach(function(macAddress) {
    presentOwners.push(getOwner(macAddress));
  });
  return joinPhrases(presentOwners);
}

function logLostBeacon(macAddress) {
  var msg = getOwner(macAddress) + ' left.\nPresent members: ' + getPresentBeaconOwners();
  notify(msg);
}

function logFoundBeacon(macAddress) {
  var msg = getOwner(macAddress) + ' is arriving.\nPresent members: ' + getPresentBeaconOwners();
  notify(msg);
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
    showRainbowLEDPattern();
  } else if (state == 'unreachable') {
    console.info('UNREACHABLE');
  } else {
    console.error('Unknown lock state: ' + state);
  }
}

function processImage(data) {
  latestJpegData = Buffer.from(data, 'base64');
}

function updateBleScannerHealth(data) {
  if (data.deviceName.indexOf('SLBeaconTest') != 0) {
    return;
  }
  if (data.source == 'INDOOR_SCANNER') {
    indoorScannerLastHealthyTime = new Date();
  } else {
    outdoorScannerLastHealthyTime = new Date();
  }
}

function process(data) {
  if (data.type == 'nfc') {
    processNfc(data.url);
  } else if (data.type == 'ble') {
    updateBleScannerHealth(data);
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

exports.isIndoorScannerHealthy = function() {
  var timeToTest = new Date().getTime() - 60 * 1000;
  return indoorScannerLastHealthyTime.getTime() >= timeToTest;
}

exports.isOutdoorScannerHealthy = function() {
  var timeToTest = new Date().getTime() - 60 * 1000;
  return outdoorScannerLastHealthyTime.getTime() >= timeToTest;
}

