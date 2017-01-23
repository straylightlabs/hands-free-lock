const express = require('express');
const path = require('path');

const indexController = require('./controllers/index-controller');
const lockController = require('./controllers/lock-controller.js')

module.exports = function(app) {
  app.use(express.static(path.join(__dirname, 'static')))
  app.get('/', indexController.get);
  app.post('/report', lockController.post);
}

