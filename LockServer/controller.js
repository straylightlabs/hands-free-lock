const base = require('airtable').base('appI5wbax01HyDamh');
const request = require('request');
const utils = require('./utils');

const AUGUST_ACCESS_TOKEN = '<TOKEN>';
const DOOR_3C_ID = '394D1ABD12AF4886A5331C0652713448';
const DOOR_3D_ID = 'BBD5DDBBADE948DCA163DE5245279F31';
const DOOR_3C_UNLOCK_URL = 'https://api-production.august.com/remoteoperate/' + DOOR_3C_ID + '/unlock';
const DOOR_3D_UNLOCK_URL = 'https://api-production.august.com/remoteoperate/' + DOOR_3D_ID + '/unlock';

const LED_URL = 'http://192.168.0.6:8080';
const SECONDS_TO_LEAVE = 10 * 60;
const SECONDS_TO_LOSE_SIGNAL = 5 * 60;

var URI_WHITELIST = new Map();
function reloadIDFromAirtable() {
  base('People').select({
    fields: ['First Name', 'Beacon ID'],
    filterByFormula: "NOT({Beacon ID} = '')"
  }).firstPage(function(error, records) {
    if (error) {
      return console.error('[ERROR] Failed to load IDs from Airtable: ' + error);
    }
    URI_WHITELIST =
      new Map(records.filter(r => r.get('Beacon ID')).map(r => [
        r.get('Beacon ID'),
        {name: r.get('First Name')}
      ]));
    console.info('URI_WHITELIST:', URI_WHITELIST);
  });
}
reloadIDFromAirtable();
setInterval(reloadIDFromAirtable, 10 * 60 * 1000);

const lastSeenMap = new Map();
const presentMacAddressSet = new Set();
const leavingMacAddressSet = new Set();
const leftoverMacAddressSet = new Set();
const scanner0LastHealthyTime = new Date();
const scanner1LastHealthyTime = new Date();

function sendUnlockAction(url, callback) {
  request({
    method: 'PUT',
    uri: url,
    json: {},
    headers: {
      'Content-Type': 'application/json',
      'x-august-access-token': AUGUST_ACCESS_TOKEN,
      'x-august-api-key': '14445b6a2dba',
    },
  }, (err, res, data) => {
    if (err) {
      console.error('[ERROR] Accessing August API: ', err);
    } else if (res.statusCode !== 200) {
      console.error('[ERROR] Bad status code from August API: ', res.statusCode);
    } else if (callback) {
      callback();
    }
  });
}

const sendUnlockActions = utils.throttle(5000, function() {
  sendUnlockAction(DOOR_3C_UNLOCK_URL, () => {
    sendUnlockAction(DOOR_3D_UNLOCK_URL);
  });
});

function showRainbowLEDPattern() {
  utils.get(LED_URL + '/rainbow()');
}

function notify(text) {
  console.info('UPDATE: ' + text);
}

function clearAfterUnlock() {
  leavingMacAddressSet.clear();
  leftoverMacAddressSet.clear();
}

function unlock() {
  setTimeout(showRainbowLEDPattern, 2000);
  sendUnlockActions();
  clearAfterUnlock();
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
  const now = new Date().getTime();
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
  const msg = getOwner(macAddress) + ' left.\nPresent members: ' + getOwners(presentMacAddressSet);
  notify(msg);
}

function logFoundBeacon(macAddress) {
  const msg = getOwner(macAddress) + ' is arriving.\nPresent members: ' + getOwners(presentMacAddressSet);
  notify(msg);
}

function updateBleScannerHealth(data) {
  if (data.deviceName.indexOf('SLBeaconTest') != 0) {
    return;
  }
  if (data.source === 'SCANNER0') {
    scanner0LastHealthyTime = new Date();
  } else if (data.source === 'SCANNER1') {
    scanner1LastHealthyTime = new Date();
  }
}

function process(data) {
  console.info('Incoming data: ' + JSON.stringify(data));
  if (data.type == 'ble') {
    updateBleScannerHealth(data);
    processBle(data.macAddress, data.rssi);
  } else {
    console.error('[ERROR] Unknown message type: ' + data.type);
  }
}

exports.post = function(req, res) {
  process(req.body);
  res.send('OK');
}

exports.checkHealth = function() {
  const timeToTest = new Date().getTime() - 3600 * 1000;
  if (scanner0LastHealthyTime.getTime() < timeToTest) {
    console.error('[ERROR] BLE scanner 0 is down');
  }
  if (scanner1LastHealthyTime.getTime() < timeToTest) {
    console.error('[ERROR] BLE scanner 1 is down');
  }
  //utils.get(3C_DOOR_STATUS_URL, function(err) {
  //  console.error('[ERROR] Lock device is unreachable');
  //}, 10 * 1000);
  utils.get(`${LED_URL}/set(0,0,0)`, function(err) {
    console.error('[ERROR] LED controller is down');
  }, 10 * 1000);
}

