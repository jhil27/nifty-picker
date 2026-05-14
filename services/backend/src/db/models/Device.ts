import { Schema, model, Document } from 'mongoose';

export interface DeviceDocument extends Document {
  token: string;
  platform: 'ios' | 'android';
  createdAt: Date;
}

const deviceSchema = new Schema<DeviceDocument>({
  token:    { type: String, required: true, unique: true },
  platform: { type: String, enum: ['ios', 'android'], required: true },
}, { timestamps: true });

export default model<DeviceDocument>('Device', deviceSchema);
