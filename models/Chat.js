import mongoose from 'mongoose';
const MessageSchema = new mongoose.Schema({
  senderHash: String,
  text: String,
  at: { type: Date, default: Date.now }
}, { _id: false });
const ChatSchema = new mongoose.Schema({
  roomId: { type: String, index: true },
  users: [{ hash: String }],
  messages: [MessageSchema],
  startedAt: { type: Date, default: Date.now },
  closedAt: Date
}, { versionKey: false });
export default mongoose.model('Chat', ChatSchema);