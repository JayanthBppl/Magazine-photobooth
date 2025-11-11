const mongoose = require("mongoose");

const sessionSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true },
    layoutId: { type: String, required: true },
    consent: { type: Boolean, required: true },
    cloudinaryUrl: { type: String },
    publicId: { type: String },
  },
  { timestamps: true }
);

module.exports = mongoose.model("Session", sessionSchema);
