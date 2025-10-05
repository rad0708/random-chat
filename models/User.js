import mongoose from 'mongoose';

const UserSchema = new mongoose.Schema({
  nickname: { type: String, required: true },
  gender: { type: String, enum: ['male','female','other','unknown'], default: 'unknown' },
  region: { type: String },
  interests: [{ type: String }],
  ip: { type: String },
  lastActiveAt: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('User', UserSchema);
