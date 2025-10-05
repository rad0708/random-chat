import mongoose from 'mongoose';
const BlacklistSchema = new mongoose.Schema({
  ipHash: { type: String, index: true },
  reason: String,
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
export default mongoose.model('Blacklist', BlacklistSchema);