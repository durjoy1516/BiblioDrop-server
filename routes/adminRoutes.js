const express = require("express");
const User = require("../models/User");
const Book = require("../models/Book");
const Delivery = require("../models/Delivery");
const Transaction = require("../models/Transaction");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

// সব Admin Route এর জন্য Global Middleware Protection
router.use(verifyToken, verifyRole("admin"));

// ==========================================
// 📊 DASHBOARD STATS API
// ==========================================

// ১. অ্যাডমিন ড্যাশবোর্ড স্ট্যাটস (এখানে অ্যাডমিন ডাটাবেজের সব বইয়ের সংখ্যা দেখতে পাবে)
router.get("/stats", async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalLibrarians = await User.countDocuments({ role: "librarian" });
    
    // অ্যাডমিন প্রজেক্টের সব বইয়ের হিসাব পাবে (Pending + Published + Unpublished)
    const totalBooks = await Book.countDocuments(); 
    
    const totalDeliveries = await Delivery.countDocuments({ status: "Delivered" });

    // মোট রেভিনিউ / লেনদেন হিসাব
    let totalRevenue = 0;
    try {
      const transactions = await Transaction.find();
      totalRevenue = transactions.reduce((sum, tx) => sum + (Number(tx.amount) || 0), 0);
    } catch (e) {
      totalRevenue = 0;
    }

    res.json({ 
      totalUsers, 
      totalLibrarians, 
      totalBooks, 
      totalDeliveries, 
      totalRevenue 
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 👥 USER MANAGEMENT ROUTES
// ==========================================

// ২. সব ইউজারের তালিকা
router.get("/users", async (req, res) => {
  try {
    const users = await User.find().select("-password").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৩. ইউজারের রোল পরিবর্তন (User / Librarian / Admin)
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

// ৪. ইউজার মুছে ফেলা
router.delete("/users/:id", async (req, res) => {
  try {
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

// ==========================================
// 📚 BOOK MANAGEMENT & APPROVAL ROUTES
// ==========================================

// ৫. অ্যাডমিনের জন্য সব বই (পেন্ডিং এবং প্রকাশিত উভয়ই)
router.get("/books", async (req, res) => {
  try {
    const books = await Book.find().sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৬. পেন্ডিং বই অনুমোদন করা (Approve & Publish)
router.patch("/books/:id/approve", async (req, res) => {
  try {
    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      { status: "Published" },
      { new: true }
    );

    if (!updatedBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৭. বই অপ্রকাশিত করা (Unpublish)
router.patch("/books/:id/unpublish", async (req, res) => {
  try {
    const updatedBook = await Book.findByIdAndUpdate(
      req.params.id,
      { status: "Unpublished" },
      { new: true }
    );

    if (!updatedBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৮. বই ডিলিট করা
router.delete("/books/:id", async (req, res) => {
  try {
    const deletedBook = await Book.findByIdAndDelete(req.params.id);

    if (!deletedBook) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json({ message: "Book deleted successfully", id: req.params.id });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৯. ক্যাটাগরি ভিত্তিক বইয়ের চার্ট ডাটা
router.get("/category-stats", async (req, res) => {
  try {
    const categoryStats = await Book.aggregate([
      { $group: { _id: "$category", value: { $sum: 1 } } },
      { $project: { _id: 0, name: "$_id", value: 1 } },
    ]);
    res.json(categoryStats);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ==========================================
// 💳 TRANSACTION ROUTES
// ==========================================

// ১০. সব ট্রানজাকশনের হিস্ট্রি
router.get("/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find().sort({ createdAt: -1 });
    res.json(transactions);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;