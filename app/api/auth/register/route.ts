import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { hashPassword } from "@/lib/auth"; // Adjust path to where your auth file is

export async function POST(req: NextRequest) {
  await connectDB();
  try {
    const { email, password, fullName, role } = await req.json();

    if (!email || !password || !fullName) {
      return NextResponse.json({ error: "Email, password, and full name are required" }, { status: 400 });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return NextResponse.json({ error: "User with this email already exists" }, { status: 409 });
    }

    // Hash the password before saving
    const hashedPassword = await hashPassword(password);

    // Create the new user
    const newUser = new User({
      email,
      password: hashedPassword,
      fullName,
      role: role || "staff", // Default role if none provided
    });

    await newUser.save();

    return NextResponse.json({ 
      success: true, 
      message: "User created successfully" 
    }, { status: 201 });

  } catch (error: any) {
    console.error("Register Error:", error);
    return NextResponse.json({ error: "Server error during registration" }, { status: 500 });
  }
}