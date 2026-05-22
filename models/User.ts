import mongoose, { Schema } from 'mongoose';

const UserSchema = new Schema({
  // Changed from 'username' to 'email'
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  fullName: { type: String, required: true },
  role: { 
    type: String, 
    // I added 'staff' and 'doctor' to your enums just in case you need them later
    enum: ['admin', 'op', 'billing', 'staff', 'doctor','Receptionist','pharmasist','Lab'], 
    required: true,
    default: 'staff'
  },
  lastLogin: { type: Date },
});

export const User = mongoose.models.User || mongoose.model('User', UserSchema);