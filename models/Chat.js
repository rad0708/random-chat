import mongoose from 'mongoose';

const ChatSchema = new mongoose.Schema({
  roomId: { type: String, index: true },
  messages: [{
    from: String,
    nickname: String,
    text: String,
    at: { type: Date, default: Date.now }
  }],
  participants: [{ type: String }],
  closedAt: { type: Date }
}, { timestamps: true });

export default mongoose.model('Chat', ChatSchema);
