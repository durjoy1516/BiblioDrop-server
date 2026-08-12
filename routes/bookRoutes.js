const express = require("express");
const mongoose = require("mongoose");
const Book = require("../models/Book");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

// 1. Public: Browse Published Books (Search, Filter, Pagination)
router.get("/", async (req, res) => {
  try {
    const { search, category, minFee, maxFee, page = 1, limit = 8 } = req.query;

    const conditions = [];

    // Status Filter: Matches "Published", "published", "Pending Approval", or documents without a status
    conditions.push({
      $or: [
        { status: "Published" },
        { status: "published" },
        { status: "Pending Approval" },
        { status: { $exists: false } },
      ],
    });

    // Search Filter (Title or Author)
    if (search) {
      conditions.push({
        $or: [
          { title: { $regex: search, $options: "i" } },
          { author: { $regex: search, $options: "i" } },
        ],
      });
    }

    // Category / Genre Filter
    if (category && category !== "All") {
      conditions.push({
        $or: [
          { category: category },
          { genre: category },
        ],
      });
    }

    // Price / Delivery Fee Range Filter
    if (minFee || maxFee) {
      const max = Number(maxFee || 9999);
      const min = Number(minFee || 0);
      conditions.push({
        $or: [
          { deliveryFee: { $gte: min, $lte: max } },
          { price: { $gte: min, $lte: max } },
          { price: { $exists: false }, deliveryFee: { $exists: false } },
        ],
      });
    }

    const query = conditions.length > 0 ? { $and: conditions } : {};

    const total = await Book.countDocuments(query);

    let queryExecution = Book.find(query).populate("owner", "name email photoURL");

    if (limit !== "all" && Number(limit) > 0) {
      queryExecution = queryExecution
        .skip((Number(page) - 1) * Number(limit))
        .limit(Number(limit));
    }

    const books = await queryExecution;

    res.json({
      books,
      totalPages: limit === "all" ? 1 : Math.ceil(total / Number(limit)) || 1,
      total,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 2. Public: Get Single Book Details by ID (সংশোধিত ও নতুন যুক্ত রুট)
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    // MongoDB ObjectId Validation Check
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Book ID format" });
    }

    const book = await Book.findById(id).populate("owner", "name email photoURL");

    if (!book) {
      return res.status(404).json({ message: "Book not found" });
    }

    res.json(book);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 3. Add Book (Librarian/Admin -> Initial Status: Pending Approval)
router.post("/", verifyToken, verifyRole("librarian", "admin"), async (req, res) => {
  try {
    const book = await Book.create({
      ...req.body,
      owner: req.user.id,
      status: "Pending Approval",
    });
    res.status(201).json(book);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 4. Admin Approve & Publish
router.patch("/:id/approve", verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Book ID format" });
    }

    const book = await Book.findByIdAndUpdate(
      id,
      { status: "Published" },
      { new: true }
    );

    if (!book) return res.status(404).json({ message: "Book not found" });

    res.json(book);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 5. Toggle Publish/Unpublish (Librarian/Admin)
router.patch("/:id/toggle-publish", verifyToken, verifyRole("librarian", "admin"), async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid Book ID format" });
    }

    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ message: "Book not found" });

    if (book.status === "Pending Approval" && req.user.role !== "admin") {
      return res.status(400).json({ message: "Cannot publish pending book without admin approval" });
    }

    book.status = book.status === "Published" ? "Unpublished" : "Published";
    await book.save();
    res.json(book);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;