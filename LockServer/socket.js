const WebSocketServer = require('ws').Server;
const path = require('path');
const url = require('url');

const lockController = require('./controllers/lock-controller.js')

module.exports = function(server) {
  const wss = new WebSocketServer({ server: server });
  wss.on('connection', function(ws) {
    var location = url.parse(ws.upgradeReq.url, true);
    if (location.pathname == '/report') {
      ws.on('message', lockController.socket);
    }
  });
}

