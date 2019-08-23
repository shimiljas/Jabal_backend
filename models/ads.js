var mongoose = require("mongoose");
var Schema = mongoose.Schema;

var AdsSchema = new Schema({
  id: { type: Number },
  url: { type: String }
});

// Export the model
module.exports = mongoose.model("Ads", AdsSchema);
