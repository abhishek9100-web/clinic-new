import mongoose, { Schema } from 'mongoose';

const RMPSchema = new Schema({
  customId: { type: String, unique: true },
  name: String,
  phone: String,
  specialization: String,
  clinicName: String,
  address: String,
  discountPercent: Number,
});

export const RMP = mongoose.models.RMP || mongoose.model('RMP', RMPSchema);