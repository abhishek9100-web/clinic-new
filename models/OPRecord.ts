import mongoose, { Schema } from 'mongoose';

const OPRecordSchema = new Schema({
  opId: { type: String }, // <-- REMOVED unique: true so the same patient can have multiple visit records
  name: { type: String, required: true },
  age: String,
  gender: String,
  phone: { type: String, required: true },
  village: String,
  doctorId: { type: String, ref: 'Doctor' },
  doctorName: String,
  consultationFee: Number,
  finalAmount: Number,
  paymentMethod: String,
  transactionId: String,
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["waiting", "in-consultation", "completed"], default: "waiting" },
  vitals: { bp: String, weight: String, temperature: String },
  referredByRmpId: { type: String, ref: 'RMP' },
  referredByRmpName: String,
  isAdmitted: { type: Boolean, default: false },
});

export const OPRecord = mongoose.models.OPRecord || mongoose.model('OPRecord', OPRecordSchema);