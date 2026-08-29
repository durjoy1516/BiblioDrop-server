const mongoose = require("mongoose");

let isConnected = false;

const connectDB = async () => {
  if (isConnected) {
    return;
  }

  try {
    const conn = await mongoose.connect(process.env.MONGO_URI);
    isConnected = conn.connections[0].readyState;
    console.log("MongoDB Connected Successfully");
  } catch (error) {
    console.error(`MongoDB Connection Error: ${error.message}`);
    // Serverless-এ process.exit(1) দেওয়া যাবে না
  }
};

module.exports = connectDB;