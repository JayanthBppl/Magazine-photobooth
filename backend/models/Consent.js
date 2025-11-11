const mongoose = require("mongoose");
const Schema = mongoose.Schema;

const ConsentSchema = new Schema({
  userId: { type: Schema.Types.ObjectId, ref: "User", required: false },
  layoutId: { type: String, required: true },
  consent: { type: Boolean, required: true },
  cloudinaryUrl: { type: String },
  publicId: { type: String },
  createdAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Consent", ConsentSchema);
