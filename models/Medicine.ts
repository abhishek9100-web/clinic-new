import mongoose, { Schema } from 'mongoose';

const MedicineSchema = new Schema(
  {
    customId: { type: String, unique: true, sparse: true },

    // Core identification
    name:         { type: String, required: true },
    schedule:     { type: String, default: '' },
    batchNumber:  { type: String, default: '' },
    manufacturer: { type: String, default: '' },
    category:     { type: String, default: 'Tablet' },
    description:  { type: String, default: '' },

    // Pack info
    pack:           { type: String, default: '' },   // e.g. "10'S", "100ML"
    hsn:            { type: String, default: '' },   // HSN tax code
    tabletsPerSheet:{ type: Number, default: 10 },
    sheetsPerPack:  { type: Number, default: 1 },

    // Pricing
    pricePerTablet: { type: Number, default: 0 },   // RATE column
    mrp:            { type: Number, default: 0 },   // Maximum Retail Price
    gst:            { type: Number, default: 0 },   // GST %
    dis:            { type: Number, default: 0 },   // Discount %
    amt:            { type: Number, default: 0 },   // Total amount (invoice line)

    // Stock
    stockQuantity: { type: Number, default: 0 },
    free:          { type: Number, default: 0 },    // Free qty from invoice

    // Dates — always stored as a proper JS Date (midnight UTC)
    expiryDate: { type: Date, default: null },
  },
  { timestamps: true }
);

export const Medicine =
  mongoose.models.Medicine || mongoose.model('Medicine', MedicineSchema);