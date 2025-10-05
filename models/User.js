import mongoose from 'mongoose';
const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true, index: true },
  passwordHash: { type: String, required: true },
  isAdmin: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
}, { versionKey: false });
export default mongoose.model('User', UserSchema);