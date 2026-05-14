from .indicators import analyze_ticker


def score_ticker(ticker: str) -> dict:
    """Wraps analyze_ticker with a consistent return shape including error state."""
    try:
        return analyze_ticker(ticker)
    except Exception as e:
        return {
            "ticker": ticker,
            "error": str(e),
            "signals": {},
            "score": 0,
            "passed": False,
            "stop_loss": None,
            "current_price": None,
        }
