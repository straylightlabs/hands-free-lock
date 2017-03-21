const lock = require('./lock-controller');
const utils = require('./utils');

function notify(text) {
  console.info(text);
  utils.notifySlack({
    channel: '#alerts',
    text: text,
    username: 'Lock System Monitoring'
  });
}

exports.checkHealth = function() {
  if (!lock.isIndoorScannerHealthy()) {
    notify('Indoor BLE scanner is down');
  }
  if (!lock.isOutdoorScannerHealthy()) {
    notify('Outdoor BLE scanner is down');
  }
  utils.get('http://192.168.0.6:8080/set(0,0,0)', function(err) {
    notify('LED controller is down');
  }, 1000);
  utils.get('http://192.168.0.3:8080/status', function(err) {
    notify('Lock controller is down');
  }, 1000);
}

