import asyncio
from fastapi import FastAPI
from pydantic import BaseModel
from engine.signals import score_ticker

app = FastAPI(title="Nifty Technical Engine")


class AnalyzeRequest(BaseModel):
    tickers: list[str]


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/analyze")
async def analyze(req: AnalyzeRequest):
    loop = asyncio.get_event_loop()
    tasks = [
        loop.run_in_executor(None, score_ticker, ticker)
        for ticker in req.tickers
    ]
    results = await asyncio.gather(*tasks)
    sorted_results = sorted(results, key=lambda r: r["score"], reverse=True)
    return {"results": sorted_results}
