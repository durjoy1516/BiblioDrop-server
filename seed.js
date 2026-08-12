const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");
require("dotenv").config();

const User = require("./models/User");
const Book = require("./models/Book");

const seedDatabase = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGO_URI);
    console.log("MongoDB connected for seeding...");

    // Clear existing data (Optional)
    await User.deleteMany({});
    await Book.deleteMany({});
    console.log("Existing users & books cleared.");

    // 1. Create Admin User (Requirement অনুযায়ী Updated Credentials)
    const adminPassword = await bcrypt.hash("Admin@123", 10);
    const admin = await User.create({
      name: "Super Admin",
      email: "admin@gmail.com",
      password: adminPassword,
      role: "admin",
      photoURL: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
    });

    // 2. Create Librarian User
    const libPassword = await bcrypt.hash("lib12345", 10);
    const librarian = await User.create({
      name: "John Librarian",
      email: "librarian@gmail.com",
      password: libPassword,
      role: "librarian",
      photoURL: "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
    });

    // 3. Create Sample Published Books
    await Book.create([
      {
        title: "The Great Gatsby",
        author: "F. Scott Fitzgerald",
        description: "A novel set in the Jazz Age that tells the story of Jay Gatsby's unrequited love for Daisy Buchanan.",
        category: "Fiction",
        deliveryFee: 5,
        coverImage: "https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c",
        status: "Published",
        owner: librarian._id,
      },
      {
        title: "To Kill a Mockingbird",
        author: "Harper Lee",
        description: "A gripping, heart-wrenching, and wholly remarkable tale of coming-of-age in a South poisoned by virulent prejudice.",
        category: "Classic",
        deliveryFee: 4,
        coverImage: "https://images.unsplash.com/photo-1512820790803-83ca734da794",
        status: "Published",
        owner: librarian._id,
      },
      {
        title: "Clean Code",
        author: "Robert C. Martin",
        description: "A Handbook of Agile Software Craftsmanship for developers.",
        category: "Technology",
        deliveryFee: 6,
        coverImage: "https://images.unsplash.com/photo-1532012197267-da84d127e765",
        status: "Published",
        owner: librarian._id,
      }
    ]);

    console.log("✅ Database Seeded Successfully!");
    console.log("-----------------------------------------");
    console.log("Admin Email: admin@gmail.com | Pass: Admin@123");
    console.log("Librarian Email: librarian@gmail.com | Pass: lib12345");
    console.log("-----------------------------------------");

    process.exit(0);
  } catch (error) {
    console.error("❌ Seeding Error:", error.message);
    process.exit(1);
  }
};

seedDatabase();