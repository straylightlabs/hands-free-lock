const base = require('airtable').base('appI5wbax01HyDamh');
const utils = require('./utils');

var LOCK_URL = 'http://192.168.0.3:8080';
var LED_URL = 'http://192.168.0.6:8080';
var SECONDS_TO_LEAVE = 10 * 60;
var SECONDS_TO_LOSE_SIGNAL = 5 * 60;

var URI_WHITELIST = new Map();
function reloadIDFromAirtable() {
  base('People').select({
    fields: ['First Name', 'Invitation URL', 'Beacon ID'],
    filterByFormula: "OR(NOT({Invitation URL} = ''), NOT({Beacon ID} = ''))"
  }).firstPage(function(error, records) {
    if (error) {
      return console.error('Failed to load IDs from Airtable: ' + error);
    }
    URI_WHITELIST =
      new Map(records.filter(r => r.get('Invitation URL')).map(r => [
        'https://straylight.jp/one/' + r.get('Invitation URL'),
        {name: r.get('First Name')}
      ]).concat(records.filter(r => r.get('Beacon ID')).map(r => [
        r.get('Beacon ID'),
        {name: r.get('First Name')}
      ])));
    console.info('URI_WHITELIST:', URI_WHITELIST);
  });
}
reloadIDFromAirtable();
setInterval(reloadIDFromAirtable, 10 * 60 * 1000);

var lastSeenMap = new Map();
var presentMacAddressSet = new Set();
var leavingMacAddressSet = new Set();
var leftoverMacAddressSet = new Set();
var leavingMacAddressClearTimer;
var latestJpegData;
var indoorScannerLastHealthyTime = new Date();
var outdoorScannerLastHealthyTime = new Date();
var isLockDeviceReachable;

var sendUnlockAction = utils.throttle(5000, function() {
  utils.get(LOCK_URL + '/unlock');
});

function showRainbowLEDPattern() {
  utils.get(LED_URL + '/rainbow()');
}

function showGreenPulseLEDPattern() {
  utils.get(LED_URL + '/pulse(0,255,0,1.0,5)');
}

function showRedPulseLEDPattern() {
  utils.get(LED_URL + '/pulse(255,0,0,1.0,10)');
}

var startupTime = new Date();
function notifySlack(text) {
  // Suppress log message during the startup.
  if (new Date().getTime() - startupTime.getTime() < 60 * 1000) {
    return;
  }
  console.info(text);
  utils.notifySlack({
    channel: '#logs',
    text: text,
    username: 'Front door'
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

function processNfc(url) {
  if (URI_WHITELIST.has(url)) {
    console.info('UNLOCKING with NFC: ' + url);
    notifySlack(getOwner(url) + ' is arriving.');
    showRainbowLEDPattern();
    unlock();
  }
}

function processBle(macAddress, rssi) {
  if (!URI_WHITELIST.has(macAddress)) {
    return;
  }
  lastSeenMap.set(macAddress, new Date().getTime());
  if (!leavingMacAddressSet.has(macAddress) &&
      !leftoverMacAddressSet.has(macAddress) &&
      !presentMacAddressSet.has(macAddress)) {
    presentMacAddressSet.add(macAddress);
    logFoundBeacon(macAddress);
    unlock();
  }
}

setInterval(function() {
  var now = new Date().getTime();
  for (var [macAddress, lastSeen] of lastSeenMap) {
    if (lastSeen !== undefined && now - lastSeen >= SECONDS_TO_LOSE_SIGNAL * 1000) {
      presentMacAddressSet.delete(macAddress);
      lastSeenMap.delete(macAddress);
      logLostBeacon(macAddress);
    }
  }
}, 60 * 1000);

function getOwner(key) {
  return URI_WHITELIST.has(key) ? URI_WHITELIST.get(key).name : 'Unknown Person';
}

function getOwners(macAddresses) {
  function joinPhrases(arr) {
    if (arr.length == 0) {
      return '';
    }
    if (arr.length == 1) {
      return arr[0];
    }
    return arr.slice(0, -1).join(', ') + ' and ' + arr[arr.length - 1];
  }

  if (!Array.isArray(macAddresses)) {
    macAddresses = [...macAddresses];
  }
  return joinPhrases(macAddresses.map(a => getOwner(a)));
}

function logLostBeacon(macAddress) {
  var msg = getOwner(macAddress) + ' left.\nPresent members: ' + getOwners(presentMacAddressSet);
  notifySlack(msg);
}

function logFoundBeacon(macAddress) {
  var msg = getOwner(macAddress) + ' is arriving.\nPresent members: ' + getOwners(presentMacAddressSet);
  notifySlack(msg);
}

function processLockStateChange(state) {
  console.info('processLockStateChange: ' + state);
  if (state == 'locked') {
    notifySlack('The door is locked.');

    leavingMacAddressSet = new Set(presentMacAddressSet);
    console.info('Leaving IDs: ' + [...leavingMacAddressSet]);

    clearTimeout(leavingMacAddressClearTimer);
    leavingMacAddressClearTimer = setTimeout(function() {
      leavingMacAddressSet.clear();

      leftoverMacAddressSet = new Set(presentMacAddressSet);
      console.info('Leftover IDs: ' + [...leftoverMacAddressSet]);
    }, SECONDS_TO_LEAVE * 1000);
  } else if (state == 'unlocked') {
    notifySlack('The door is unlocked.');
    clearAfterUnlock();
    showGreenPulseLEDPattern();
  } else if (state == 'reachable') {
    isLockDeviceReachable = true;
  } else if (state == 'unreachable') {
    isLockDeviceReachable = false;
  } else if (state == 'delayLocking') {
    showRedPulseLEDPattern();
  } else if (state == 'locking' || state == 'unlocking') {
    // do nothing
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
  var timeToTest = new Date().getTime() - 120 * 1000;
  return indoorScannerLastHealthyTime.getTime() >= timeToTest;
}

exports.isOutdoorScannerHealthy = function() {
  var timeToTest = new Date().getTime() - 120 * 1000;
  return outdoorScannerLastHealthyTime.getTime() >= timeToTest;
}

exports.isLockDeviceReachable = function() {
  // Assume "no report" means healthy.
  return isLockDeviceReachable === undefined || isLockDeviceReachable;
}

