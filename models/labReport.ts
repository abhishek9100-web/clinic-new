import mongoose, { Schema } from 'mongoose';

// ─── Sub-schema: one result row inside a test section ───────────────────────
const ResultRowSchema = new Schema(
  {
    investigation: { type: String, default: '' },
    value:         { type: String, default: '' },
    unit:          { type: String, default: '' },
    normalValue:   { type: String, default: '' },
  },
  { _id: false }
);

// ─── Sub-schema: one test section (e.g. "RFT", "CBC") ──────────────────────
const TestSectionSchema = new Schema(
  {
    sectionTitle: { type: String, required: true },   // e.g. "RENAL FUNCTION TEST"
    method:       { type: String, default: '' },       // e.g. "Immunoassay Turbidimetry"
    rows:         { type: [ResultRowSchema], default: [] },
    // For non-table tests like Blood Group, Widal, Malaria, BT/CT
    freeTextRows: { type: [String], default: [] },     // ["Blood Group : O", "Rh : POSITIVE"]
    sectionType:  {
      type: String,
      enum: ['table', 'freetext'],
      default: 'table',
    },
  },
  { _id: false }
);

// ─── Main LabReport schema ───────────────────────────────────────────────────
const LabReportSchema = new Schema(
  {
    // Linking
    reportId:    { type: String, unique: true, required: true }, // e.g. "LR-00001"
    orderId:     { type: String, required: true },               // matches LabOrder.orderId (LB-XXXXX)
    opId:        { type: String, required: true },
    serialNo:    { type: Number, default: 1 },                   // per-patient serial (1,2,3…)

    // Patient snapshot (denormalised for PDF)
    patientName: { type: String, required: true },
    phone:       { type: String, default: '' },
    age:         { type: String, default: '' },
    gender:      { type: String, default: '' },
    village:     { type: String, default: '' },
    doctorName:  { type: String, default: '' },

    // Report meta
    reportDate:  { type: Date, default: Date.now },
    reportType:  { type: String, required: true },  // the lab service name, e.g. "RFT"

    // Actual result data — one or more sections
    sections:    { type: [TestSectionSchema], default: [] },

    // Lifecycle
    status: {
      type: String,
      enum: ['pending', 'completed'],
      default: 'pending',
    },

    // Audit: who filled the report and when (for the 15-min delete window)
    filledBy:   { type: String, default: '' },
    filledAt:   { type: Date, default: null },

    // Soft-delete: only pending reports can be truly deleted;
    // completed reports revert to pending when values are cleared.
    isDeleted:  { type: Boolean, default: false },
  },
  { timestamps: true }
);

export const LabReport =
  mongoose.models.LabReport || mongoose.model('LabReport', LabReportSchema);