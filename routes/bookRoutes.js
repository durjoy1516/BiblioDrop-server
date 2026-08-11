const express = require("express");
const Book = require("../models/Book");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

// Public: Browse Published Books (Search, Filter, Pagination)
router.get("/", async (req, res) => {
  try {
    const { search, category, minFee, maxFee, page = 1, limit = 8 } = req.query;
    let query = { status: "Published" };

    if (search) query.title = { $regex: search, $options: "i" };
    if (category) query.category = category;
    if (minFee || maxFee) query.deliveryFee = { $gte: Number(minFee || 0), $lte: Number(maxFee || 9999) };

    const total = await Book.countDocuments(query);
    const books = await Book.find(query)
      .populate("owner", "name email photoURL")
      .skip((page - 1) * limit)
      .limit(Number(limit));

    res.json({ books, totalPages: Math.ceil(total / limit), total });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Add Book (Librarian/Admin -> Initial Status: Pending Approval)
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

// Admin Approve & Publish
router.patch("/:id/approve", verifyToken, verifyRole("admin"), async (req, res) => {
  try {
    const book = await Book.findByIdAndUpdate(req.params.id, { status: "Published" }, { new: true });
    res.json(book);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Toggle Publish/Unpublish (Librarian/Admin)
router.patch("/:id/toggle-publish", verifyToken, verifyRole("librarian", "admin"), async (req, res) => {
  try {
    const book = await Book.findById(req.params.id);
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