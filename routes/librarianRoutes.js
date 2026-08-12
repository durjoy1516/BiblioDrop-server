const express = require("express");
const Book = require("../models/Book");
const Delivery = require("../models/Delivery");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

// সব Librarian Route-এর জন্য JWT ও Role Verification
router.use(verifyToken, verifyRole("librarian"));

// ১. Librarian Stats & Overview
router.get("/stats", async (req, res) => {
  try {
    const librarianEmail = req.user.email;

    const totalBooks = await Book.countDocuments({ ownerEmail: librarianEmail });
    
    // লাইব্রেরিয়ানের বইগুলোর মোট ডেলিভারি সংখ্যা ও পেন্ডিং হিসাব
    const librarianBooks = await Book.find({ ownerEmail: librarianEmail }).select("_id");
    const bookIds = librarianBooks.map((b) => b._id);

    const activePendingRequests = await Delivery.countDocuments({
      bookId: { $in: bookIds },
      status: "Pending",
    });

    const completedDeliveries = await Delivery.find({
      bookId: { $in: bookIds },
      status: "Delivered",
    });

    // মোট আয় হিসাব করা
    const totalEarnings = completedDeliveries.reduce((sum, item) => sum + (item.deliveryFee || 0), 0);

    res.json({
      totalBooks,
      activePendingRequests,
      totalEarnings,
    });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ২. Add Book (Initial status strictly set to "Pending Approval")
router.post("/books", async (req, res) => {
  try {
    const { title, author, description, deliveryFee, category, image } = req.body;

    const newBook = new Book({
      title,
      author,
      description,
      deliveryFee: parseFloat(deliveryFee),
      category,
      image,
      ownerEmail: req.user.email,
      status: "Pending Approval", // নির্দেশনামা অনুযায়ী ডিফোল্ট স্ট্যাটাস
    });

    await newBook.save();
    res.status(201).json(newBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৩. Get Inventory (Librarian's own added books)
router.get("/my-books", async (req, res) => {
  try {
    const books = await Book.find({ ownerEmail: req.user.email }).sort({ createdAt: -1 });
    res.json(books);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৪. Edit Book
router.put("/books/:id", async (req, res) => {
  try {
    const book = await Book.findOne({ _id: req.params.id, ownerEmail: req.user.email });
    if (!book) return res.status(404).json({ message: "Book not found or unauthorized" });

    const updatedBook = await Book.findByIdAndUpdate(req.params.id, req.body, { new: true });
    res.json(updatedBook);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৫. Toggle Publish/Unpublish (Only allowed if not "Pending Approval")
router.patch("/books/:id/status", async (req, res) => {
  try {
    const book = await Book.findOne({ _id: req.params.id, ownerEmail: req.user.email });
    if (!book) return res.status(404).json({ message: "Book not found or unauthorized" });

    if (book.status === "Pending Approval") {
      return res.status(400).json({ message: "Librarian cannot publish a Pending Approval book!" });
    }

    const newStatus = book.status === "Published" ? "Unpublished" : "Published";
    book.status = newStatus;
    await book.save();

    res.json(book);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৬. Delete Book
router.delete("/books/:id", async (req, res) => {
  try {
    const book = await Book.findOneAndDelete({ _id: req.params.id, ownerEmail: req.user.email });
    if (!book) return res.status(404).json({ message: "Book not found or unauthorized" });

    res.json({ message: "Book deleted successfully" });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৭. Manage Deliveries (Librarian's incoming orders)
router.get("/deliveries", async (req, res) => {
  try {
    const librarianBooks = await Book.find({ ownerEmail: req.user.email }).select("_id");
    const bookIds = librarianBooks.map((b) => b._id);

    const deliveries = await Delivery.find({ bookId: { $in: bookIds } })
      .populate("bookId", "title")
      .sort({ createdAt: -1 });

    res.json(deliveries);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// ৮. Update Delivery Status (Pending -> Dispatched -> Delivered)
router.patch("/deliveries/:id/status", async (req, res) => {
  try {
    const { status } = req.body;
    if (!["Pending", "Dispatched", "Delivered"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const delivery = await Delivery.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;