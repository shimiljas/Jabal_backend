var express = require('express');
var router = express.Router();

// Require the controllers WHICH WE DID NOT CREATE YET!!
var customer = require('../controllers/customer');

// a simple test url to check that all of our files are communicating correctly.

router.post('/sale/new', customer.create_sale);
router.post('/sale/search', customer.search);

module.exports = router;
