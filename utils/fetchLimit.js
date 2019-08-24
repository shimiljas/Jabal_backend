var Limit = require('../models/limit');

exports.fetchLimit = () => {
  return new Promise((resolve, reject) => {
    Limit.findOne({}, {}, { sort: { created_at: -1 } })
      .then(resolve)
      .catch(reject);
  });
};
