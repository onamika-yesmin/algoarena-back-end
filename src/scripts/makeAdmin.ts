import { connectDatabase } from "../config/database.js";
import { UserModel } from "../models/User.model.js";
import mongoose from "mongoose";

const ADMIN_EMAILS = ["johna1@gmail.com", "onamikaonu086@gmail.com"];

async function setTargetAdmins() {
  await connectDatabase();
  
  // Reset all users to 'user' role first
  await UserModel.updateMany({}, { $set: { role: "user" } });
  
  // Set specified admin emails to 'admin' role
  const updateResult = await UserModel.updateMany(
    { email: { $in: ADMIN_EMAILS.map((e) => e.toLowerCase().trim()) } },
    { $set: { role: "admin" } }
  );

  console.log(`Updated ${updateResult.modifiedCount} accounts to 'admin' role.`);

  const adminUsers = await UserModel.find({ role: "admin" }).select("email role");
  console.log("Current Admin Accounts in DB:");
  adminUsers.forEach((u) => console.log(` - ${u.email}`));

  const adminCount = await UserModel.countDocuments({ role: "admin" });
  const userCount = await UserModel.countDocuments({ role: "user" });
  console.log(`Total Admins: ${adminCount}, Total Users: ${userCount}`);

  await mongoose.disconnect();
  process.exit(0);
}

setTargetAdmins().catch((err) => {
  console.error("Failed to update admin roles:", err);
  process.exit(1);
});
