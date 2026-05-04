import mongoose, { Schema } from 'mongoose';

const ServiceSchema = new Schema({
  customId: { type: String, unique: true },
  name: String, 
  category: String, 
  amount: Number, 
  description: String, 
  bodyPart: String,
});

export const Service = mongoose.models.Service || mongoose.model('Service', ServiceSchema);