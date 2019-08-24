var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var LimitSchema = new Schema({
  discount: { type: Number, default: 30 },
  limit: { type: Number, default: 1000 },
});

// Export the model
module.exports = mongoose.model('Limit', LimitSchema);
