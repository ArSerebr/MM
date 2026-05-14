import os
from typing import List

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

load_dotenv()

app = FastAPI(title="Quest Recovery System")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def get_secret_keys() -> List[str]:
    keys = [
        os.getenv("SECRET_KEY_1", ""),
        os.getenv("SECRET_KEY_2", ""),
        os.getenv("SECRET_KEY_3", ""),
        os.getenv("SECRET_KEY_4", ""),
    ]
    if not all(keys):
        raise RuntimeError("All SECRET_KEY_1..4 environment variables must be set")
    return keys


class RestoreRequest(BaseModel):
    keys: List[str] = Field(..., min_length=4, max_length=4)


class RestoreResponse(BaseModel):
    success: bool
    message: str


@app.get("/api/health")
def health():
    return {"status": "compromised"}


@app.post("/api/restore", response_model=RestoreResponse)
def restore_system(payload: RestoreRequest):
    expected = get_secret_keys()
    provided = [k.strip() for k in payload.keys]

    if provided == expected:
        return RestoreResponse(
            success=True,
            message="Всё круто! Система восстановлена",
        )

    raise HTTPException(
        status_code=400,
        detail="Неверные ключи восстановления. Система остаётся скомпрометированной.",
    )
