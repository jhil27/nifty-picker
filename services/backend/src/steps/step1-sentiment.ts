import {
  getMarketSentiment,
  getSectorPerformance,
  getNifty50Stocks,
} from '../nse/nse-api';

export async function runStep1() {
  const [sentiment, sectors, stocks] = await Promise.all([
    getMarketSentiment(),
    getSectorPerformance(),
    getNifty50Stocks(),
  ]);
  return {
    sentiment,
    topSectors: sectors.top3,
    allStocks:  stocks,
  };
}
