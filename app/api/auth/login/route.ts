import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { User } from "@/models/User";
import { comparePassword, signToken } from "@/lib/auth";

export async function POST(req: NextRequest) {
  await connectDB();
  try {
    const { email, password } = await req.json();

    if (!email || !password) {
      return NextResponse.json({ error: "Email and password required" }, { status: 400 });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    const isPasswordValid = await comparePassword(password, user.password);
    if (!isPasswordValid) {
      return NextResponse.json({ error: "Invalid email or password" }, { status: 401 });
    }

    // 1. Generate JWT token (remember the await!)
    const token = await signToken({ userId: user._id, email: user.email, role: user.role });

    user.lastLogin = new Date();
    await user.save();

    // 2. Prepare the response
    const response = NextResponse.json({ 
      success: true, 
      token, 
      user: { email: user.email, fullName: user.fullName, role: user.role } 
    });

    // 3. ✨ MAGIC FIX: Set the token as a secure HTTP cookie ✨
    response.cookies.set({
      name: 'token',
      value: token,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 // 24 hours
    });

    return response;

  } catch (error: any) {
    console.error("Login Error:", error);
    return NextResponse.json({ error: "Server error during login" }, { status: 500 });
  }
}