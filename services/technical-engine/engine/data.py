import time
import yfinance as yf
import pandas as pd


def download(ticker: str, period: str, interval: str) -> pd.DataFrame:
    df = yf.download(ticker, period=period, interval=interval, auto_adjust=True, progress=False)
    time.sleep(0.5)
    return df
