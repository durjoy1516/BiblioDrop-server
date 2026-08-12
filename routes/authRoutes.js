const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

// Cookie Option Helper Function
const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction, // Localhost (HTTP)-এ false থাকবে
  sameSite: isProduction ? "none" : "lax", // Localhost cross-port এর জন্য lax
  maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
};

// Register
router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role, photoURL } = req.body;

    if (!password) {
      return res.status(400).json({ message: "Password is required for manual registration" });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: "Email already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      password: hashedPassword,
      role: role || "user",
      photoURL,
    });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, cookieOptions);
    res.status(201).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photoURL: user.photoURL,
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Login
router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(400).json({ message: "User not found" });

    // Google দিয়ে একাউন্ট খোলা ইউজার যদি পাসওয়ার্ড ছাড়া লগইন করার চেষ্টা করে
    if (!user.password) {
      return res.status(400).json({
        message: "This account was created with Google. Please use Google Sign-In.",
      });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, cookieOptions);
    res.json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photoURL: user.photoURL,
      },
      token,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Google Login / Register Handler
router.post("/google", async (req, res) => {
  try {
    const { name, email, photoURL, role } = req.body;

    if (!email) {
      return res.status(400).json({ message: "Email is required" });
    }

    // চেক করি ডাটাবেজে ইউজার আগে থেকেই আছে কিনা
    let user = await User.findOne({ email });

    // যদি ইউজার না থাকে তবে নতুন তৈরি করি (পাসওয়ার্ড ছাড়া)
    if (!user) {
      user = await User.create({
        name,
        email,
        photoURL,
        role: role || "user",
      });
    }

    // JWT Token জেনারেট
    const token = jwt.sign(
      { id: user._id, email: user.email, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.cookie("token", token, cookieOptions);
    res.status(200).json({
      success: true,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photoURL: user.photoURL,
      },
      token,
    });
  } catch (err) {
    console.error("Google auth route error:", err);
    res.status(500).json({ message: err.message });
  }
});

// Logout
router.post("/logout", (req, res) => {
  res.clearCookie("token", cookieOptions);
  res.json({ message: "Logged out successfully" });
});

// Get Current User Info
router.get("/me", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const user = await User.findById(userId).select("-password");
    if (!user) return res.status(404).json({ message: "User not found" });

    res.json({
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        photoURL: user.photoURL,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Profile (Name & PhotoURL)
router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const { name, photoURL } = req.body;
    const userId = req.user.id || req.user._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized: User ID not found in token" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { name, photoURL },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({
      message: "Profile updated successfully",
      user: {
        id: updatedUser._id,
        name: updatedUser.name,
        email: updatedUser.email,
        role: updatedUser.role,
        photoURL: updatedUser.photoURL,
      },
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Change User Role (Admin Only)
router.patch("/users/:id/role", verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const { role } = req.body;
    const user = await User.findByIdAndUpdate(req.params.id, { role }, { new: true });
    res.json(user);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;