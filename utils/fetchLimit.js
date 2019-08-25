var Limit = require('../models/limit');

exports.fetchLimit = () => {
  return new Promise((resolve, reject) => {
    Limit.findOne({}, {}, { sort: { created_at: -1 } })
      .then(res => {
        if (res == null) {
          resolve({ limit: 1000, discount: 30 });
        } else {
          resolve(res);
        }
      })
      .catch(err => {
        console.log(err, '=========');
        reject(err);
      });
  });
};
