import mongoose, { Schema } from 'mongoose';

// 1. Create a Counter Schema to track the sequence securely
const CounterSchema = new Schema({
  _id: { type: String, required: true },
  seq: { type: Number, default: 0 }
});

const Counter = mongoose.models.Counter || mongoose.model('Counter', CounterSchema);

// 2. Your Receipt Schema
const ReceiptSchema = new Schema({
  receiptId: { type: String, unique: true }, // This will now be auto-generated
  opId: String,
  patientName: String,
  phone: String,
  type: { type: String, enum: ["op", "payment", "medicine", "xray", "treatment", "surgery", "ip", "scan", "lab"] },
  category: String,
  amount: Number,
  method: String,
  date: { type: Date, default: Date.now },
  time: String,
  details: String,
  itemDetails: [{ name: String, quantity: Number, amount: Number }],
});

// 3. Pre-save hook to auto-increment the receiptId
// REMOVED 'next' - Using pure async/await for Mongoose 5+
ReceiptSchema.pre('save', async function () {
  const doc = this;
  
  // Only generate a new receiptId if this is a brand new document and doesn't have one yet
  if (doc.isNew && !doc.receiptId) {
    try {
      // findByIdAndUpdate is atomic, meaning it prevents duplicate IDs
      const counter: any = await Counter.findByIdAndUpdate(
        { _id: 'receiptId' }, 
        { $inc: { seq: 1 } }, 
        { new: true, upsert: true } // upsert creates the counter doc if it doesn't exist yet
      );
      
      // Format the sequence with leading zeros (e.g., REC-00001, REC-00002)
      doc.receiptId = `REC-${counter.seq.toString().padStart(5, '0')}`;
      
    } catch (error) {
      // Throw the error instead of using next(error)
      throw error; 
    }
  }
});

export const Receipt = mongoose.models.Receipt || mongoose.model('Receipt', ReceiptSchema);