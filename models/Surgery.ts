import mongoose, { Schema } from 'mongoose';

const SurgerySchema = new Schema({
  id: { type: String, unique: true },
  ipId: String, 
  patientName: String, 
  phone: String,
  surgery: String, 
  surgeon: String, 
  date: Date, 
  status: String,
});

export const Surgery = mongoose.models.Surgery || mongoose.model('Surgery', SurgerySchema);