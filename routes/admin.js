var express = require('express');
var router = express.Router();

// Require the controllers WHICH WE DID NOT CREATE YET!!
var admin = require('../controllers/admin');

// a simple test url to check that all of our files are communicating correctly.

router.post('/login', admin.login);
router.get('/get/all', admin.getall);

module.exports = router;
