const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

require("dotenv").config();

const User = require("./models/User");

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);

    console.log("MongoDB connected for seeding...");

    // ==============================
    // ADMIN
    // ==============================

    let admin = await User.findOne({
      email: "admin@gmail.com",
    });

    if (!admin) {
      const adminPassword = await bcrypt.hash(
        "Admin@123",
        10
      );

      await User.create({
        name: "Super Admin",
        email: "admin@gmail.com",
        password: adminPassword,
        role: "admin",
        photoURL:
          "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde",
      });

      console.log("✅ Admin created");
    } else {
      console.log("ℹ️ Admin already exists");
    }

    // ==============================
    // LIBRARIAN
    // ==============================

    let librarian = await User.findOne({
      email: "librarian@gmail.com",
    });

    if (!librarian) {
      const librarianPassword = await bcrypt.hash(
        "lib12345",
        10
      );

      await User.create({
        name: "John Librarian",
        email: "librarian@gmail.com",
        password: librarianPassword,
        role: "librarian",
        photoURL:
          "https://images.unsplash.com/photo-1494790108377-be9c29b29330",
      });

      console.log("✅ Librarian created");
    } else {
      console.log("ℹ️ Librarian already exists");
    }

    // ==============================
    // DONE
    // ==============================

    console.log("");
    console.log("======================================");
    console.log("BiblioDrop database seeding completed!");
    console.log("======================================");
    console.log("📚 Existing books were NOT modified.");
    console.log("👤 Existing users were NOT deleted.");
    console.log("======================================");
    console.log("Admin: admin@gmail.com / Admin@123");
    console.log("Librarian: librarian@gmail.com / lib12345");
    console.log("======================================");

    await mongoose.disconnect();

    process.exit(0);
  } catch (error) {
    console.error("Seeding Error:", error.message);

    await mongoose.disconnect();

    process.exit(1);
  }
};

seedDatabase();