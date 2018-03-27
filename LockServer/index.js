const bodyParser = require('body-parser');
const cors = require('cors');
const express = require('express');
const http = require('http');

const controller = require('./controller');

const PORT = 8080;

const server = http.createServer();
const app = express();
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());
app.use(cors());
app.post('/report', controller.post);

server.on('request', app);
server.listen(PORT, function () {
  console.log('Listening on ' + server.address().port);
});

// console.log('Checking health every 10 mins');
// setInterval(controller.checkHealth, 10 * 60 * 1000);

