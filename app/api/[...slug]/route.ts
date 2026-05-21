import { NextRequest, NextResponse } from "next/server";
import connectDB from "@/lib/db";
import { ModelMap, getIdField } from "@/models";

export async function GET(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  await connectDB();
  
  // 🔥 Next.js 15: Await the params
  const resolvedParams = await params;
  const collection = resolvedParams.slug[0].toLowerCase();
  const id = resolvedParams.slug[1]; 
  const Model = ModelMap[collection];

  if (!Model) return NextResponse.json({ error: "Invalid API route" }, { status: 404 });

  try {
    // If an ID is provided (e.g., /api/doctors/DOC-123), fetch just that one
    if (id) {
      const idField = getIdField(collection);
      const data = await Model.findOne({ [idField]: id });
      if (!data) return NextResponse.json({ error: "Record not found" }, { status: 404 });
      return NextResponse.json(data);
    }
    
    // Otherwise, fetch all records (e.g., /api/doctors)
    const data = await Model.find({});
    return NextResponse.json(data);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  await connectDB();
  
  // 🔥 Next.js 15: Await the params
  const resolvedParams = await params;
  const collection = resolvedParams.slug[0].toLowerCase();
  const Model = ModelMap[collection];

  if (!Model) return NextResponse.json({ error: "Invalid API route" }, { status: 404 });

  try {
    const body = await req.json();
    const newData = await Model.create(body);
    return NextResponse.json(newData, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function PUT(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  await connectDB();
  const resolvedParams = await params;
  const collection = resolvedParams.slug[0].toLowerCase();
  const id = resolvedParams.slug[1];
  const Model = ModelMap[collection];

  if (!Model || !id) return NextResponse.json({ error: "Route or ID missing" }, { status: 400 });

  try {
    const body = await req.json();
    const idField = getIdField(collection);

    // Try customId first, then fall back to _id
    let updated = await Model.findOneAndUpdate({ [idField]: id }, body, { new: true, runValidators: true });
    if (!updated) {
      updated = await Model.findByIdAndUpdate(id, body, { new: true, runValidators: true });
    }

    if (!updated) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    return NextResponse.json(updated);
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ slug: string[] }> }) {
  await connectDB();
  const resolvedParams = await params;
  const collection = resolvedParams.slug[0].toLowerCase();
  const id = resolvedParams.slug[1];
  const Model = ModelMap[collection];

  if (!Model || !id) return NextResponse.json({ error: "Route or ID missing" }, { status: 400 });

  try {
    const idField = getIdField(collection);

    // Try customId first, then fall back to _id
    let deleted = await Model.findOneAndDelete({ [idField]: id });
    if (!deleted) {
      deleted = await Model.findByIdAndDelete(id);
    }

    if (!deleted) return NextResponse.json({ error: "Record not found" }, { status: 404 });
    return NextResponse.json({ message: "Deleted successfully" });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
