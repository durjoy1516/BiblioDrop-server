const mongoose = require("mongoose");

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: false }, // Google Sign-In এর জন্য এটি false করা হলো
    role: { type: String, enum: ["user", "librarian", "admin"], default: "user" },
    photoURL: { type: String, default: "" },
  },
  { timestamps: true }
);

module.exports = mongoose.models.User || mongoose.model("User", userSchema);