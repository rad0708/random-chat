import mongoose from 'mongoose';

const ReportSchema = new mongoose.Schema({
  reporter: String,
  target: String,
  reason: String,
  roomId: String,
  at: { type: Date, default: Date.now }
}, { timestamps: true });

export default mongoose.model('Report', ReportSchema);
