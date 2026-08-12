const express = require("express");
const Stripe = require("stripe");
const Delivery = require("../models/Delivery");
const Book = require("../models/Book");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// 💳 Create Payment Intent for Stripe
router.post("/create-payment-intent", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    if (!amount || amount <= 0) {
      return res.status(400).json({ message: "Invalid payment amount" });
    }

    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Cents e convert করা হচ্ছে
      currency: "usd",
      payment_method_types: ["card"],
    });

    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🟢 Get User Specific Borrow/Loan History (Supports both /my-loans & /my-orders)
router.get(["/my-loans", "/my-orders"], verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;

    const deliveries = await Delivery.find({ user: userId })
      .populate("book", "title author coverImage category deliveryFee")
      .sort({ createdAt: -1 });

    res.json({ success: true, deliveries, loans: deliveries });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔍 CHECK DELIVERY STATUS FOR VERIFIED REVIEW SYSTEM
// (ইউজার বইটি 'Delivered' অবস্থায় পেয়েছে কি না তা যাচাই করার জন্য)
router.get("/check-delivery/:bookId", verifyToken, async (req, res) => {
  try {
    const userId = req.user.id || req.user._id;
    const { bookId } = req.params;

    const isDelivered = await Delivery.findOne({
      user: userId,
      book: bookId,
      status: "Delivered",
    });

    res.json({ canReview: !!isDelivered });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 📦 Create Delivery Request
router.post("/", verifyToken, async (req, res) => {
  try {
    const { bookId, transactionId, deliveryFee } = req.body;

    if (!transactionId) {
      return res.status(400).json({ message: "Transaction ID is required." });
    }

    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    // বইটি ইতোমধ্যে Checked Out থাকলে নতুন অর্ডার বন্ধ রাখা
    if (book.status === "Checked Out") {
      return res.status(400).json({ message: "Book is currently checked out." });
    }

    const delivery = await Delivery.create({
      book: bookId,
      user: req.user.id || req.user._id,
      librarian: book.owner || book.librarian,
      transactionId,
      deliveryFee: deliveryFee || book.deliveryFee || 5.0,
      status: "Pending",
    });

    // বইটির স্ট্যাটাস 'Checked Out' করে দেওয়া
    book.status = "Checked Out";
    await book.save();

    res.status(201).json({ success: true, delivery });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// 🔄 Update Status (Pending -> Dispatched -> Delivered)
router.patch("/:id/status", verifyToken, verifyRole("librarian", "admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await Delivery.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true }
    ).populate("book");

    if (!delivery) {
      return res.status(404).json({ message: "Delivery order not found" });
    }

    // যদি অর্ডারটি রিটার্ন হয় বা বাতিল হয়, বইটির স্ট্যাটাস আবার 'Available' করে দেওয়া
    if (status === "Returned" || status === "Cancelled") {
      await Book.findByIdAndUpdate(delivery.book, { status: "Available" });
    }

    res.json(delivery);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;