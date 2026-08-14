const express = require("express");
const Stripe = require("stripe");

const Book = require("../models/Book");
const Delivery = require("../models/Delivery");
const Transaction = require("../models/Transaction");

const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// =====================================================
// CREATE PAYMENT INTENT
// =====================================================

router.post(
  "/create-payment-intent",
  verifyToken,
  async (req, res) => {
    try {
      const { bookId } = req.body;

      const book = await Book.findById(bookId);

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      if (book.status !== "Published") {
        return res.status(400).json({
          success: false,
          message: "This book is currently unavailable.",
        });
      }

      if (book.owner.toString() === req.user.id) {
        return res.status(403).json({
          success: false,
          message: "You cannot request delivery of your own book.",
        });
      }

      const amount = Number(book.deliveryFee);

      if (!amount || amount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Invalid delivery fee.",
        });
      }

      const paymentIntent =
        await stripe.paymentIntents.create({
          amount: Math.round(amount * 100),
          currency: "usd",
          automatic_payment_methods: {
            enabled: true,
          },

          metadata: {
            bookId: book._id.toString(),
            userId: req.user.id,
            librarianId: book.owner.toString(),
          },
        });

      res.json({
        success: true,
        clientSecret: paymentIntent.client_secret,
        paymentIntentId: paymentIntent.id,
        amount,
      });
    } catch (error) {
      console.error("Stripe error:", error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// CONFIRM PAYMENT + CREATE TRANSACTION + DELIVERY
// =====================================================

router.post(
  "/confirm-payment",
  verifyToken,
  async (req, res) => {
    try {
      const { paymentIntentId } = req.body;

      if (!paymentIntentId) {
        return res.status(400).json({
          success: false,
          message: "Payment Intent ID is required.",
        });
      }

      const paymentIntent =
        await stripe.paymentIntents.retrieve(
          paymentIntentId
        );

      if (paymentIntent.status !== "succeeded") {
        return res.status(400).json({
          success: false,
          message: "Payment has not been completed.",
        });
      }

      // Prevent duplicate transaction
      const existingTransaction =
        await Transaction.findOne({
          paymentIntentId,
        });

      if (existingTransaction) {
        const existingDelivery =
          await Delivery.findOne({
            transactionId:
              existingTransaction.transactionId,
          }).populate("book");

        return res.json({
          success: true,
          message: "Payment already processed.",
          transaction: existingTransaction,
          delivery: existingDelivery,
        });
      }

      const {
        bookId,
        userId,
        librarianId,
      } = paymentIntent.metadata;

      // Ensure payment belongs to logged-in user
      if (userId !== req.user.id) {
        return res.status(403).json({
          success: false,
          message: "Payment does not belong to this user.",
        });
      }

      const book = await Book.findById(bookId);

      if (!book) {
        return res.status(404).json({
          success: false,
          message: "Book not found.",
        });
      }

      if (book.status !== "Published") {
        return res.status(400).json({
          success: false,
          message: "Book is no longer available.",
        });
      }

      const amount =
        paymentIntent.amount_received / 100;

      const transaction = await Transaction.create({
        user: req.user.id,
        librarian: librarianId,
        book: bookId,
        amount,
        transactionId: paymentIntent.id,
        paymentIntentId: paymentIntent.id,
        status: "completed",
      });

      const delivery = await Delivery.create({
        book: bookId,
        user: req.user.id,
        librarian: librarianId,
        transactionId: paymentIntent.id,
        deliveryFee: amount,
        status: "Pending",
      });

      // Lock the book
      book.status = "Checked Out";
      await book.save();

      const populatedDelivery =
        await Delivery.findById(delivery._id)
          .populate("book", "title author coverImage")
          .populate("user", "name email photoURL")
          .populate(
            "librarian",
            "name email photoURL"
          );

      res.status(201).json({
        success: true,
        message:
          "Payment successful and delivery request created.",
        transaction,
        delivery: populatedDelivery,
      });
    } catch (error) {
      console.error(error);

      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// USER DELIVERY HISTORY
// =====================================================

router.get(
  "/my-orders",
  verifyToken,
  async (req, res) => {
    try {
      const deliveries = await Delivery.find({
        user: req.user.id,
      })
        .populate(
          "book",
          "title author coverImage category deliveryFee status"
        )
        .populate(
          "librarian",
          "name email photoURL"
        )
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        deliveries,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// Backward compatible endpoint
router.get(
  "/my-loans",
  verifyToken,
  async (req, res) => {
    try {
      const deliveries = await Delivery.find({
        user: req.user.id,
      })
        .populate(
          "book",
          "title author coverImage category deliveryFee status"
        )
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        loans: deliveries,
        deliveries,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// CHECK WHETHER USER CAN REVIEW
// =====================================================

router.get(
  "/check-delivery/:bookId",
  verifyToken,
  async (req, res) => {
    try {
      const delivery = await Delivery.findOne({
        book: req.params.bookId,
        user: req.user.id,
        status: "Delivered",
      });

      res.json({
        success: true,
        canReview: !!delivery,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// LIBRARIAN DELIVERY LIST
// =====================================================

router.get(
  "/librarian",
  verifyToken,
  verifyRole("librarian"),
  async (req, res) => {
    try {
      const deliveries = await Delivery.find({
        librarian: req.user.id,
      })
        .populate(
          "book",
          "title author coverImage category"
        )
        .populate(
          "user",
          "name email photoURL"
        )
        .sort({ createdAt: -1 });

      res.json({
        success: true,
        deliveries,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

// =====================================================
// UPDATE DELIVERY STATUS
// LIBRARIAN
// =====================================================

router.patch(
  "/:id/status",
  verifyToken,
  verifyRole("librarian", "admin"),
  async (req, res) => {
    try {
      const { status } = req.body;

      const allowedStatuses = [
        "Pending",
        "Dispatched",
        "Delivered",
      ];

      if (!allowedStatuses.includes(status)) {
        return res.status(400).json({
          success: false,
          message: "Invalid delivery status.",
        });
      }

      const delivery =
        await Delivery.findById(
          req.params.id
        );

      if (!delivery) {
        return res.status(404).json({
          success: false,
          message: "Delivery not found.",
        });
      }

      if (
        req.user.role === "librarian" &&
        delivery.librarian.toString() !== req.user.id
      ) {
        return res.status(403).json({
          success: false,
          message:
            "You can only manage deliveries for your own books.",
        });
      }

      // Prevent going backwards
      const statusOrder = {
        Pending: 1,
        Dispatched: 2,
        Delivered: 3,
      };

      if (
        statusOrder[status] <
        statusOrder[delivery.status]
      ) {
        return res.status(400).json({
          success: false,
          message:
            "Delivery status cannot move backwards.",
        });
      }

      delivery.status = status;

      await delivery.save();

      // Delivered means the book becomes available again.
      if (status === "Delivered") {
        await Book.findByIdAndUpdate(
          delivery.book,
          {
            status: "Published",
          }
        );
      }

      const updatedDelivery =
        await Delivery.findById(
          delivery._id
        )
          .populate(
            "book",
            "title author coverImage"
          )
          .populate(
            "user",
            "name email photoURL"
          )
          .populate(
            "librarian",
            "name email photoURL"
          );

      res.json({
        success: true,
        message:
          "Delivery status updated successfully.",
        delivery: updatedDelivery,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: error.message,
      });
    }
  }
);

module.exports = router;