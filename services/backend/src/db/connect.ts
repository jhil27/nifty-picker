import mongoose from 'mongoose';

export async function connectDB(): Promise<void> {
  const uri = process.env.MONGODB_URI ?? 'mongodb://nifty:nifty123@localhost:27017/niftypicker?authSource=admin';
  await mongoose.connect(uri);
  console.log('MongoDB connected');
}
