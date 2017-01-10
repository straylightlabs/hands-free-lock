const WebSocketServer = require('ws').Server;
const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const http = require('http');
const path = require('path');
const url = require('url');
const router = require('./router');

const port = 8080;

const server = http.createServer();
const wss = new WebSocketServer({ server: server });
wss.on('connection', function (ws) {
  var location = url.parse(ws.upgradeReq.url, true);
  ws.on('message', function (message) {
    console.log('received: %s', message);
  });
});

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
router(app);

server.on('request', app);
server.listen(port, function () {
  console.log('Listening on ' + server.address().port);
});

