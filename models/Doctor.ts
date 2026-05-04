import mongoose, { Schema } from 'mongoose';

const DoctorSchema = new Schema({
  customId: { type: String, unique: true }, 
  name: { type: String, required: true },
  specialization: String,
  fee: Number,
  phone: String,
  available: { type: Boolean, default: true },
});

export const Doctor = mongoose.models.Doctor || mongoose.model('Doctor', DoctorSchema);