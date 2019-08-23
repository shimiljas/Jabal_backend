var mongoose = require('mongoose');
var Schema = mongoose.Schema;

var CustomerSchema = new Schema({
  phone_number: { type: Number, required: true },
  total: { type: Number },
  discount: { type: Number },
  sales: [
    {
      price: Number,
      date: Date,
    },
  ],
});

// Export the model
module.exports = mongoose.model('Customer', CustomerSchema);
