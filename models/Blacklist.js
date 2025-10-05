import mongoose from 'mongoose';

const BlacklistSchema = new mongoose.Schema({
  ip: { type: String, unique: true },
  reason: String,
  until: Date
}, { timestamps: true });

export default mongoose.model('Blacklist', BlacklistSchema);
