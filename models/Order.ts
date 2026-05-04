import mongoose, { Schema } from 'mongoose';

const OrderSchema = new Schema({
  orderId: { type: String, unique: true },
  opId: String, 
  patientName: String, 
  phone: String,
  serviceIds: [String], 
  serviceNames: [String], 
  amount: Number,
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
  paymentMethod: String, 
  date: { type: Date, default: Date.now },
});

export const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);