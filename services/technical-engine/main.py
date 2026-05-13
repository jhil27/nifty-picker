from fastapi import FastAPI

app = FastAPI(title="Nifty Technical Engine")


@app.get("/health")
def health():
    return {"status": "ok"}
