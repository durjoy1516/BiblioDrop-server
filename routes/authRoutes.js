const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const User = require("../models/User");
const { verifyToken } = require("../middlewares/authMiddleware");
const { verifyRole } = require("../middlewares/roleMiddleware");

const router = express.Router();

const isProduction = process.env.NODE_ENV === "production";

const cookieOptions = {
  httpOnly: true,
  secure: isProduction,
  sameSite: isProduction ? "none" : "lax",
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

const createToken = (user) => {
  return jwt.sign(
    {
      id: user._id,
      email: user.email,
      role: user.role,
    },
    process.env.JWT_SECRET,
    {
      expiresIn: "7d",
    }
  );
};

const publicUser = (user) => ({
  id: user._id,
  name: user.name,
  email: user.email,
  role: user.role,
  photoURL: user.photoURL,
});

// ==============================
// REGISTER
// ==============================

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      confirmPassword,
      role,
      photoURL,
    } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email and password are required.",
      });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({
        success: false,
        message: "Passwords do not match.",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters.",
      });
    }

    // Public registration can only create these roles
    const allowedRoles = ["user", "librarian"];

    const selectedRole = allowedRoles.includes(role)
      ? role
      : "user";

    const normalizedEmail = email.toLowerCase().trim();

    const existingUser = await User.findOne({
      email: normalizedEmail,
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "Email already exists.",
      });
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await User.create({
      name: name.trim(),
      email: normalizedEmail,
      password: hashedPassword,
      role: selectedRole,
      photoURL: photoURL || "",
    });

    const token = createToken(user);

    res.cookie("token", token, cookieOptions);

    res.status(201).json({
      success: true,
      message: "Registration successful.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error(error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==============================
// LOGIN
// ==============================

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Email and password are required.",
      });
    }

    const user = await User.findOne({
      email: email.toLowerCase().trim(),
    });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    if (!user.password) {
      return res.status(400).json({
        success: false,
        message:
          "This account was created using Google. Please use Google Sign-In.",
      });
    }

    const matched = await bcrypt.compare(password, user.password);

    if (!matched) {
      return res.status(401).json({
        success: false,
        message: "Invalid email or password.",
      });
    }

    const token = createToken(user);

    res.cookie("token", token, cookieOptions);

    res.json({
      success: true,
      message: "Login successful.",
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==============================
// GOOGLE LOGIN
// ==============================

router.post("/google", async (req, res) => {
  try {
    const {
      name,
      email,
      photoURL,
      role,
    } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        message: "Email is required.",
      });
    }

    const normalizedEmail = email.toLowerCase().trim();

    let user = await User.findOne({
      email: normalizedEmail,
    });

    if (!user) {
      const allowedRoles = ["user", "librarian"];

      const selectedRole = allowedRoles.includes(role)
        ? role
        : "user";

      user = await User.create({
        name: name || "Google User",
        email: normalizedEmail,
        photoURL: photoURL || "",
        role: selectedRole,
        password: null,
      });
    } else {
      // Keep existing admin/librarian role.
      // Do not overwrite an existing role during Google login.
      user.name = name || user.name;
      user.photoURL = photoURL || user.photoURL;

      await user.save();
    }

    const token = createToken(user);

    res.cookie("token", token, cookieOptions);

    res.json({
      success: true,
      message: "Google login successful.",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("Google auth error:", error);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==============================
// LOGOUT
// ==============================

router.post("/logout", (req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: isProduction,
    sameSite: isProduction ? "none" : "lax",
  });

  res.json({
    success: true,
    message: "Logged out successfully.",
  });
});

// ==============================
// CURRENT USER
// ==============================

router.get("/me", verifyToken, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==============================
// UPDATE PROFILE
// ==============================

router.patch("/profile", verifyToken, async (req, res) => {
  try {
    const { name, photoURL } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Name is required.",
      });
    }

    const user = await User.findByIdAndUpdate(
      req.user.id,
      {
        name: name.trim(),
        photoURL: photoURL || "",
      },
      {
        new: true,
        runValidators: true,
      }
    ).select("-password");

    if (!user) {
      return res.status(404).json({
        success: false,
        message: "User not found.",
      });
    }

    res.json({
      success: true,
      message: "Profile updated successfully.",
      user: publicUser(user),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ==============================
// ADMIN ROLE CHANGE
// ==============================

router.patch(
  "/users/:id/role",
  verifyToken,
  verifyRole("admin"),
  async (req, res) => {
    try {
      const { role } = req.body;

      if (!["user", "librarian", "admin"].includes(role)) {
        return res.status(400).json({
          success: false,
          message: "Invalid role.",
        });
      }

      if (req.params.id === req.user.id) {
        return res.status(400).json({
          success: false,
          message: "You cannot change your own role.",
        });
      }

      const user = await User.findByIdAndUpdate(
        req.params.id,
        { role },
        {
          new: true,
          runValidators: true,
        }
      ).select("-password");

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found.",
        });
      }

      res.json({
        success: true,
        message: "User role updated successfully.",
        user: publicUser(user),
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