import mongoose, { Schema } from 'mongoose';

const TreatmentEntrySchema = new Schema({
  date: { type: Date, default: Date.now },
  time: String,
  type: String,
  description: String,
  notes: String,
  administeredBy: String,
});

const IPRecordSchema = new Schema({
  ipId: { type: String, unique: true }, 
  opId: { type: String, ref: 'OPRecord' },
  name: String,
  age: String,
  gender: String,
  phone: String,
  village: String,
  room: String,
  bed: String,
  doctor: String,
  disease: String,
  department: String,
  admissionType: { type: String, enum: ["General Admission", "Surgical Admission"] },
  management: { type: String, enum: ["Medical Management", "Surgical Management"] },
  admissionCharges: Number,
  dateOfAdmission: Date,
  dateOfDischarge: Date,
  diagnosis: String,
  type: { type: String, enum: ["Full Treatment", "Doses Only"] },
  status: { type: String, enum: ["critical", "stable", "recovering", "discharged"], default: "stable" },
  treatments: [TreatmentEntrySchema],
  notes: String,
});

export const IPRecord = mongoose.models.IPRecord || mongoose.model('IPRecord', IPRecordSchema);