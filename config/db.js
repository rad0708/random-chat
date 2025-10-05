import mongoose from 'mongoose';

export async function connectDB(uri) {
  if (!uri) throw new Error('MONGODB_URI is required when USE_DB=true');
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, { dbName: process.env.DB_NAME || undefined });
  console.log('✅ MongoDB connected');
}
