// app.js

var express = require('express');
var bodyParser = require('body-parser');
require('dotenv').config();
var product = require('./routes/product'); // Imports routes for the products
var admin = require('./routes/admin');
var customer = require('./routes/customer');

var app = express();

// Set up mongoose connection
var mongoose = require('mongoose');
var dev_db_url = 'mongodb://localhost:27017/zadi';
//var dev_db_url = 'mongodb://3.15.195.238:27017/jabalsupermarket';
var mongoDB = dev_db_url;
mongoose.connect(mongoDB, { useNewUrlParser: true });
mongoose.Promise = global.Promise;
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'MongoDB connection error:'));

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));

app.use(function (req, res, next) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader(
    'Access-Control-Allow-Methods',
    'GET, POST, OPTIONS, PUT, PATCH, DELETE',
  );
  res.setHeader(
    'Access-Control-Allow-Headers',
    'Content-Type, Authorization, token',
  );
  res.setHeader('Access-Control-Allow-Credentials', true);
  next();
});
app.use('/admin', admin);
app.use('/customer', customer);

var port = 4000;

app.listen(port, () => {
  console.log('Server is up and running on port numner ' + port);
});
