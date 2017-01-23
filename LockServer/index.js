const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const http = require('http');

const router = require('./router');
const socket = require('./socket');

const port = 8080;

const server = http.createServer();
socket(server);

const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
router(app);

server.on('request', app);
server.listen(port, function () {
  console.log('Listening on ' + server.address().port);
});

