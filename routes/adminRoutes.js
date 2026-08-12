const express = require("express");
const User = require("../models/User");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

// সব Admin Route এর জন্য Global Middleware Protection
router.use(verifyToken, verifyRole("admin"));

// ১. Dashboard Stats API
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalLibrarians = await User.countDocuments({ role: "librarian" });
    
    // Book এবং Delivery Model যুক্ত করলে এগুলো Un-comment করতে পারেন:
    // const totalBooks = await Book.countDocuments();
    // const totalDeliveries = await Delivery.countDocuments({ status: "completed" });

    const totalBooks = 0; 
    const totalDeliveries = 0; 

    res.json({ totalUsers, totalLibrarians, totalBooks, totalDeliveries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ২. Get All Users
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৩. Change User Role
router.patch("/users/:id/role", async (req, res) => {
  try {
    const { role } = req.body;

    if (!["user", "librarian", "admin"].includes(role)) {
      return res.status(400).json({ message: "Invalid role specified" });
    }

    const updatedUser = await User.findByIdAndUpdate(
      req.params.id,
      { role },
      { new: true }
    ).select("-password");

    if (!updatedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json(updatedUser);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৪. Delete User
router.delete("/users/:id", async (req, res) => {
  try {
    // নিজের অ্যাকাউন্ট ভুল করে ডিলিট না করার সেফগার্ড
    const adminId = req.user.id || req.user._id;
    if (req.params.id === adminId.toString()) {
      return res.status(400).json({ message: "You cannot delete your own admin account!" });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ message: "User not found" });
    }

    res.json({ message: "User deleted successfully", id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;