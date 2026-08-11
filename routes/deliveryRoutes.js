const express = require("express");
const Stripe = require("stripe");
const Delivery = require("../models/Delivery");
const Book = require("../models/Book");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Payment Intent for Stripe
router.post("/create-payment-intent", verifyToken, async (req, res) => {
  try {
    const { amount } = req.body;
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100),
      currency: "usd",
      payment_method_types: ["card"],
    });
    res.json({ clientSecret: paymentIntent.client_secret });
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Create Delivery Request
router.post("/", verifyToken, async (req, res) => {
  try {
    const { bookId, transactionId, deliveryFee } = req.body;
    const book = await Book.findById(bookId);
    if (!book) return res.status(404).json({ message: "Book not found" });

    const delivery = await Delivery.create({
      book: bookId,
      user: req.user.id,
      librarian: book.owner,
      transactionId,
      deliveryFee,
      status: "Pending",
    });

    book.status = "Checked Out";
    await book.save();

    res.status(201).json(delivery);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

// Update Status (Pending -> Dispatched -> Delivered)
router.patch("/:id/status", verifyToken, verifyRole("librarian", "admin"), async (req, res) => {
  try {
    const { status } = req.body;
    const delivery = await Delivery.findByIdAndUpdate(req.params.id, { status }, { new: true });
    res.json(delivery);
  } catch (err) {
    res.status(500).json({ message: err.message });
  }
});

module.exports = router;