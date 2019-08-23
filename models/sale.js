var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var Schema = mongoose.Schema;
const ObjectId = Schema.Types.ObjectId;
var SaleSchema = new Schema(
  {
    phone_number: {
      type: ObjectId,
      ref: 'customer',
    },
    date: {
      type: Date,
      default: Date.now,
    },
    price: {
      type: Number,
    },
  },
  { timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' } },
);

module.exports = mongoose.model('Sale', SaleSchema);
