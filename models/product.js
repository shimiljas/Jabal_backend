var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var ProductSchema = new Schema({
  name: { type: String, required: true, max: 100 },
  price: { type: Number, required: true },
  saleprice: { type: Number },
  offer: { type: Number },
  rating: { type: Number },
  producturl: { type: String },
  type: { type: Number, required: true }
});

// Export the model
module.exports = mongoose.model("Product", ProductSchema);
