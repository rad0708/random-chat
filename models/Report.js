import mongoose from 'mongoose';
const ReportSchema = new mongoose.Schema({
  reporterHash: String,
  targetHash: String,
  roomId: String,
  reason: String,
  createdAt: { type: Date, default: Date.now }
}, { versionKey: false });
export default mongoose.model('Report', ReportSchema);