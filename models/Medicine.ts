import mongoose, { Schema } from 'mongoose';

const MedicineSchema = new Schema({
  customId: { type: String, unique: true },
  name: { type: String, required: true },
  schedule: String,
  batchNumber: String,
  pricePerTablet: Number,
  tabletsPerSheet: Number,
  sheetsPerPack: Number,
  category: String,
  manufacturer: String,
  expiryDate: Date,
  stockQuantity: Number,
  description: String,
});

export const Medicine = mongoose.models.Medicine || mongoose.model('Medicine', MedicineSchema);