var express = require("express");
var router = express.Router();

// Require the controllers WHICH WE DID NOT CREATE YET!!
var ads_controller = require("../controllers/ads");

// a simple test url to check that all of our files are communicating correctly.

router.post("/create", ads_controller.create);

router.get("/list", ads_controller.list);

module.exports = router;
