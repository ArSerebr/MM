from typing import List

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

app = FastAPI(title="Quest Recovery System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

SECRET_KEYS = [
    "6b86b273ff34fce19d6b804eff5a3f5747ada4eaa22f1d49c01e52ddb7875b4b",
    "d4735e3a265e16eee03f59718b9b5d03019c07d8b6c51f90da3a666eec13ab35",
    "4e07408562bedb8b60ce05c1decfe3ad16b72230967de01f640b7e4729b49fce",
    "4b227777d4dd1fc61c6f884f48641d02b4d121d3fd328cb08b5531fcacdabf8a",
]


class RestoreRequest(BaseModel):
    keys: List[str] = Field(..., min_length=4, max_length=4)


class RestoreResponse(BaseModel):
    success: bool
    message: str


@app.get("/health")
@app.get("/api/health")
def health():
    return {"status": "compromised"}


@app.post("/restore", response_model=RestoreResponse)
@app.post("/api/restore", response_model=RestoreResponse)
def restore_system(payload: RestoreRequest):
    provided = [k.strip() for k in payload.keys]

    if provided == SECRET_KEYS:
        return RestoreResponse(
            success=True,
            message="Всё круто! Система восстановлена",
        )

    raise HTTPException(
        status_code=400,
        detail="Неверные ключи восстановления. Система остаётся скомпрометированной.",
    )
