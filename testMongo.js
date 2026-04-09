import mongoose from "mongoose";
import dotenv from "dotenv";

dotenv.config();

const uri = process.env.MONGODB_URI;

mongoose
    .connect(uri)
    .then(() => {
        console.log("✅ Connected to MongoDB!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("❌ MongoDB connection failed:", err);
        process.exit(1);
    });