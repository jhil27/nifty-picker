import { Schema, model, Document } from 'mongoose';

interface StockPick {
  rank: number;
  ticker: string;
  companyName: string;
  sector: string;
  buyPrice: number;
  targetPrice: number;
  stopLoss: number;
  score: {
    total: number;
    sentiment: number;
    fundamental: number;
    qualitative: number;
    technical: number;
    seasonality: number;
  };
  rationale: string;
  analystTarget: number;
  analystRating: 'Strong Buy' | 'Buy' | 'Hold';
}

export interface PickDocument extends Document {
  date: Date;
  market: {
    niftyChange: number;
    sentiment: 'bullish' | 'bearish' | 'neutral';
    fiiFlow: number;
    advanceDeclineRatio: number;
  };
  picks: StockPick[];
  generatedAt: Date;
  pipelineStatus: 'success' | 'partial' | 'failed';
}

const scoreSchema = new Schema({
  total:       { type: Number, required: true },
  sentiment:   { type: Number, required: true },
  fundamental: { type: Number, required: true },
  qualitative: { type: Number, required: true },
  technical:   { type: Number, required: true },
  seasonality: { type: Number, required: true },
}, { _id: false });

const stockPickSchema = new Schema({
  rank:          { type: Number, required: true },
  ticker:        { type: String, required: true },
  companyName:   { type: String, required: true },
  sector:        { type: String, required: true },
  buyPrice:      { type: Number, required: true },
  targetPrice:   { type: Number, required: true },
  stopLoss:      { type: Number, required: true },
  score:         { type: scoreSchema, required: true },
  rationale:     { type: String, required: true },
  analystTarget: { type: Number, required: true },
  analystRating: { type: String, enum: ['Strong Buy', 'Buy', 'Hold'], required: true },
}, { _id: false });

const pickSchema = new Schema<PickDocument>({
  date: { type: Date, required: true },
  market: {
    niftyChange:         { type: Number, required: true },
    sentiment:           { type: String, enum: ['bullish', 'bearish', 'neutral'], required: true },
    fiiFlow:             { type: Number, required: true },
    advanceDeclineRatio: { type: Number, required: true },
  },
  picks:          { type: [stockPickSchema], default: [] },
  generatedAt:    { type: Date, default: Date.now },
  pipelineStatus: { type: String, enum: ['success', 'partial', 'failed'], required: true },
});

pickSchema.index({ date: -1 });

export default model<PickDocument>('Pick', pickSchema);
