import { Schema, model, Document } from 'mongoose';

interface PickEntry {
  symbol:      string;
  companyName: string;
  score:       number;
  verdict:     'STRONG_BUY' | 'BUY';
  rationale:   string;
  risks:       string[];
  entryPrice:  number | null;
  stopLoss:    number | null;
  targets:     { t1: number | null; t2: number | null };
}

export interface PickDocument extends Document {
  date:           Date;
  sentiment:      'bullish' | 'bearish' | 'neutral';
  niftyChange:    number;
  fiiNetCrores:   number;
  adRatio:        number;
  topSectors:     string[];
  picks:          PickEntry[];
  generatedAt:    Date;
  pipelineStatus: 'success' | 'partial' | 'failed';
}

const pickEntrySchema = new Schema({
  symbol:      { type: String, required: true },
  companyName: { type: String, required: true },
  score:       { type: Number, required: true },
  verdict:     { type: String, enum: ['STRONG_BUY', 'BUY'], required: true },
  rationale:   { type: String, required: true },
  risks:       [{ type: String }],
  entryPrice:  { type: Number, default: null },
  stopLoss:    { type: Number, default: null },
  targets:     { t1: { type: Number, default: null }, t2: { type: Number, default: null } },
}, { _id: false });

const pickSchema = new Schema<PickDocument>({
  date:           { type: Date, required: true },
  sentiment:      { type: String, enum: ['bullish', 'bearish', 'neutral'], required: true },
  niftyChange:    { type: Number, required: true },
  fiiNetCrores:   { type: Number, default: 0 },
  adRatio:        { type: Number, default: 0 },
  topSectors:     [{ type: String }],
  picks:          { type: [pickEntrySchema], default: [] },
  generatedAt:    { type: Date, default: Date.now },
  pipelineStatus: { type: String, enum: ['success', 'partial', 'failed'], required: true },
});

pickSchema.index({ date: -1 });

export default model<PickDocument>('Pick', pickSchema);
