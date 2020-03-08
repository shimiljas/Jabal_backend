var Customer = require('../models/customer');

exports.login = function(req, res) {
  var adminData = req.body ? req.body : {};

  if (
    adminData.email == 'admin@zadi.com' &&
    adminData.password == 'admin@123'
  ) {
    return res.json({
      code: 200,
      status: 'success',
      message: 'Login succssfully',
      data: adminData,
    });
  } else {
    return res.json({
      code: 301,
      status: 'Error',
      message: 'Authentication failed',
    });
  }
};

exports.getall = function(req, res) {
  Customer.find({}, 'phone_number total discount', function(err, docs) {
    if (err) {
      return res.json({
        code: 301,
        status: 'Error',
        message: 'Authentication failed',
      });
    }
    return res.json({
      code: 200,
      status: 'success',
      message: 'data fetched',
      data: docs,
    });
  });
};
