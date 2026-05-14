import numpy as np
from .data import download


def _ha(open_, high, low, close):
    """Compute Heikin Ashi OHLC as a dict of arrays."""
    ha_close = (open_ + high + low + close) / 4
    ha_open = ha_close.copy()
    ha_open.iloc[0] = (open_.iloc[0] + close.iloc[0]) / 2
    for i in range(1, len(ha_open)):
        ha_open.iloc[i] = (ha_open.iloc[i - 1] + ha_close.iloc[i - 1]) / 2
    ha_high = np.maximum(high, np.maximum(ha_open, ha_close))
    ha_low  = np.minimum(low,  np.minimum(ha_open, ha_close))
    return {"HA_open": ha_open, "HA_high": ha_high, "HA_low": ha_low, "HA_close": ha_close}


def _sma(series, length):
    return series.rolling(length).mean()


def _bbands(series, length=20, std_mult=2.0):
    mid   = _sma(series, length)
    sigma = series.rolling(length).std(ddof=0)
    return {"BBU": mid + std_mult * sigma, "BBM": mid, "BBL": mid - std_mult * sigma}


def analyze_ticker(ticker: str) -> dict:
    daily  = download(ticker, period="1y",  interval="1d")
    weekly = download(ticker, period="5y",  interval="1wk")

    if daily.empty or len(daily) < 50:
        raise ValueError(f"Insufficient data for {ticker}")

    close  = daily["Close"].squeeze()
    high   = daily["High"].squeeze()
    low    = daily["Low"].squeeze()
    open_  = daily["Open"].squeeze()
    volume = daily["Volume"].squeeze()

    signals: dict[str, bool] = {}

    # 1. Heikin Ashi — HA open == HA low on last candle is bullish
    ha = _ha(open_, high, low, close)
    signals["ha_open_eq_low"] = bool(
        abs(float(ha["HA_open"].iloc[-1]) - float(ha["HA_low"].iloc[-1])) < 0.01
    )

    # 2. Bollinger Bands — close above upper band
    bb = _bbands(close, length=20)
    signals["bb_breakout"] = bool(float(close.iloc[-1]) > float(bb["BBU"].iloc[-1]))

    # 3. Volume surge — today > 1.5× 20-day average
    avg_vol = float(volume.rolling(20).mean().iloc[-1])
    signals["volume_surge"] = bool(float(volume.iloc[-1]) > avg_vol * 1.5)

    # 4. Multi-timeframe trend — price above 50 SMA on daily and weekly
    d_sma50 = float(_sma(close, 50).iloc[-1])
    w_close = weekly["Close"].squeeze()
    w_sma50 = float(_sma(w_close, 50).iloc[-1])
    signals["multi_tf_bullish"] = bool(
        float(close.iloc[-1]) > d_sma50 and float(w_close.iloc[-1]) > w_sma50
    )

    # 5. Relative strength vs Nifty 50
    nifty   = download("^NSEI", period="1mo", interval="1d")
    n_close = nifty["Close"].squeeze()
    stock_ret = float(close.iloc[-1]) / float(close.iloc[-20]) - 1
    nifty_ret = float(n_close.iloc[-1]) / float(n_close.iloc[-20]) - 1
    signals["rs_positive"] = bool(stock_ret > nifty_ret)

    score   = sum(1 for v in signals.values() if v)
    passed  = score >= 3

    return {
        "ticker":        ticker,
        "signals":       signals,
        "score":         score,
        "passed":        passed,
        "stop_loss":     round(float(low.iloc[-10:].min()), 2),
        "current_price": round(float(close.iloc[-1]), 2),
    }
