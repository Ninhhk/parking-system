"""
api/app.py — FastAPI application for repo5 LPR system (Plan A).

Exposes:
  GET  /health  — liveness check, confirms models are loaded
  POST /detect  — multipart image upload → plate recognition results
"""

import sys
import os
from contextlib import asynccontextmanager
from typing import List

import cv2
import numpy as np
import time

from fastapi import FastAPI, File, UploadFile, HTTPException
from pydantic import BaseModel

# Ensure repo5 root is importable when running from any working directory
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from core.models import load_stage1, load_stage2
from core.pipeline import run_pipeline


# ---------------------------------------------------------------------------
# Response schemas
# ---------------------------------------------------------------------------

class PlateResult(BaseModel):
    text: str
    bbox: List[float]
    confidence: float


class DetectResponse(BaseModel):
    plates: List[PlateResult]
    inference_time_ms: float
    plate_count: int


class HealthResponse(BaseModel):
    status: str
    stage1: str
    stage2: str


# ---------------------------------------------------------------------------
# Lifespan — load models once at startup
# ---------------------------------------------------------------------------

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Load Stage1 and Stage2 models into app.state before accepting requests."""
    app.state.stage1 = load_stage1()
    app.state.stage2 = load_stage2()
    yield
    # Cleanup (if needed) goes here


app = FastAPI(title="LPR YOLOv8 API", lifespan=lifespan)


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    """Return service liveness and model version info."""
    return HealthResponse(status="ok", stage1="yolov8", stage2="yolov5")


@app.post("/detect", response_model=DetectResponse)
async def detect(file: UploadFile = File(...)) -> DetectResponse:
    """Accept a multipart image upload and return plate recognition results.

    Returns HTTP 422 if the uploaded bytes cannot be decoded as an image.
    """
    raw = await file.read()

    # Decode start — inference_time_ms measured from here
    t_start = time.perf_counter()

    # Decode bytes → numpy BGR array
    if not raw:
        raise HTTPException(
            status_code=422,
            detail="Uploaded file is empty. Please upload a valid image.",
        )
    arr = np.frombuffer(raw, dtype=np.uint8)
    frame = cv2.imdecode(arr, cv2.IMREAD_COLOR)
    if frame is None:
        raise HTTPException(
            status_code=422,
            detail="Could not decode the uploaded file as an image. "
                   "Please upload a valid image (JPEG, PNG, etc.).",
        )

    # Run inference pipeline
    results = run_pipeline(frame, app.state.stage1, app.state.stage2)

    t_end = time.perf_counter()
    inference_time_ms = (t_end - t_start) * 1000.0

    plates = [
        PlateResult(
            text=r["text"],
            bbox=r["bbox"],
            confidence=r["confidence"],
        )
        for r in results
    ]

    return DetectResponse(
        plates=plates,
        inference_time_ms=inference_time_ms,
        plate_count=len(plates),
    )
