from fastapi import FastAPI, File, UploadFile, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from inference_sdk import InferenceHTTPClient
import numpy as np
import os
import base64
import asyncio
import logging
import uuid
from pathlib import Path
from PIL import Image, UnidentifiedImageError
import io
from dotenv import load_dotenv

# ======================
# ENV
# ======================
load_dotenv(dotenv_path=Path(__file__).with_name(".env"))

ROBOFLOW_API_KEY = os.getenv("ROBOFLOW_API_KEY")
ROBOFLOW_API_URL = os.getenv("ROBOFLOW_API_URL", "https://serverless.roboflow.com")
ROBOFLOW_MODEL_ID = os.getenv("ROBOFLOW_MODEL_ID")
TIMEOUT = float(os.getenv("ROBOFLOW_TIMEOUT_SECONDS", "60"))

PX_TO_MM = float(os.getenv("PX_TO_MM", "0.18"))
TARGET_MEDIAN_GRAIN_LENGTH_MM = float(os.getenv("TARGET_MEDIAN_GRAIN_LENGTH_MM", "7.4"))
WIDTH_CORRECTION_FACTOR = float(os.getenv("WIDTH_CORRECTION_FACTOR", "0.42"))

CLAMP_LENGTH_MM_MIN = float(os.getenv("CLAMP_LENGTH_MM_MIN", "5.5"))
CLAMP_LENGTH_MM_MAX = float(os.getenv("CLAMP_LENGTH_MM_MAX", "9.5"))
CLAMP_WIDTH_MM_MIN = float(os.getenv("CLAMP_WIDTH_MM_MIN", "1.4"))
CLAMP_WIDTH_MM_MAX = float(os.getenv("CLAMP_WIDTH_MM_MAX", "2.8"))

BROKEN_RELATIVE_LENGTH_FACTOR = float(os.getenv("BROKEN_RELATIVE_LENGTH_FACTOR", "0.6"))

MAX_CHALKY_RATIO = float(os.getenv("MAX_CHALKY_RATIO", "0.35"))

if not ROBOFLOW_API_KEY or not ROBOFLOW_MODEL_ID:
    raise RuntimeError("Missing Roboflow credentials")

rf = InferenceHTTPClient(api_url=ROBOFLOW_API_URL, api_key=ROBOFLOW_API_KEY)
logger = logging.getLogger("riceguard")

# ======================
# APP
# ======================
app = FastAPI(title="RiceGuard API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.middleware("http")
async def add_request_id(request, call_next):
    request_id = str(uuid.uuid4())
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# ======================
# SCHEMA
# ======================
class AnalysisResult(BaseModel):
    total_grains: int
    good_grains: int
    broken_grains: int
    foreign_matter: int
    chalky_grains: int
    avg_grain_length_mm: float
    avg_grain_width_mm: float
    note: str

# ======================
# HELPERS
# ======================
def to_base64_jpeg(image_bytes: bytes) -> str:
    try:
        img = Image.open(io.BytesIO(image_bytes)).convert("RGB")
    except (UnidentifiedImageError, OSError):
        raise ValueError("invalid_image")
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=95)
    return base64.b64encode(buf.getvalue()).decode()

def clamp(v, lo, hi):
    return max(lo, min(v, hi))

def norm(c):
    return c.lower().replace("-", "_").strip()

def is_good(c): return "good" in c or c in {"whole", "wholegrain"}
def is_broken(c): return "broken" in c
def is_chalky(c): return "chalky" in c
def is_foreign(c): return "foreign" in c

def is_foreign_by_geometry(
    *,
    width_mm_raw: float,
    aspect_ratio: float,
    area_ratio: float,
) -> bool:
    if width_mm_raw >= 4.0:
        return True
    if aspect_ratio <= 1.15:
        return True
    if area_ratio >= 4.0:
        return True
    return False

# ======================
# CORE
# ======================
def analyze_with_roboflow(image_bytes: bytes) -> AnalysisResult:
    image_b64 = to_base64_jpeg(image_bytes)
    result = rf.infer(image_b64, model_id=ROBOFLOW_MODEL_ID)
    preds = result.get("predictions", [])

    grains = []
    for p in preds:
        w, h = float(p["width"]), float(p["height"])
        if w <= 0 or h <= 0:
            continue
        grains.append({
            "cls": norm(p["class"]),
            "length_px": max(w, h),
            "width_px": min(w, h)
        })

    counts = dict(good=0, broken=0, chalky=0, foreign=0)
    lengths_mm, widths_mm = [], []

    # ---- Dynamic calibration (GOOD only) ----
    good_lengths_px = [g["length_px"] for g in grains if is_good(g["cls"])]
    px_to_mm = PX_TO_MM
    if good_lengths_px:
        px_to_mm = TARGET_MEDIAN_GRAIN_LENGTH_MM / np.median(good_lengths_px)

    median_good_len_mm = (
        np.median([l * px_to_mm for l in good_lengths_px])
        if good_lengths_px else 0
    )

    areas_mm2 = [float(g["length_px"] * g["width_px"]) * (px_to_mm ** 2) for g in grains]
    median_area_mm2 = float(np.median(areas_mm2)) if areas_mm2 else 0.0

    for g in grains:
        cls = g["cls"]
        length_mm_raw = g["length_px"] * px_to_mm
        width_mm_raw = g["width_px"] * px_to_mm

        area_mm2 = float(g["length_px"] * g["width_px"]) * (px_to_mm ** 2)
        area_ratio = (area_mm2 / (median_area_mm2 + 1e-9)) if median_area_mm2 > 0 else 0.0
        aspect_ratio = length_mm_raw / (width_mm_raw + 1e-9)

        # FOREIGN (rule-based geometry fallback)
        if is_foreign(cls) or is_foreign_by_geometry(
            width_mm_raw=width_mm_raw,
            aspect_ratio=aspect_ratio,
            area_ratio=area_ratio,
        ):
            counts["foreign"] += 1
            continue

        # BROKEN (model first)
        if is_broken(cls):
            counts["broken"] += 1

        # CHALKY
        elif is_chalky(cls):
            counts["chalky"] += 1

        # GOOD + heuristic broken
        elif is_good(cls):
            if median_good_len_mm and length_mm_raw < BROKEN_RELATIVE_LENGTH_FACTOR * median_good_len_mm:
                counts["broken"] += 1
            else:
                counts["good"] += 1

        else:
            continue

        # Record dimensions
        lengths_mm.append(clamp(length_mm_raw, CLAMP_LENGTH_MM_MIN, CLAMP_LENGTH_MM_MAX))
        widths_mm.append(clamp(width_mm_raw * WIDTH_CORRECTION_FACTOR,
                                CLAMP_WIDTH_MM_MIN, CLAMP_WIDTH_MM_MAX))

    total = counts["good"] + counts["broken"] + counts["chalky"]

    # 🚨 Chalky sanity correction
    if total > 0:
        max_chalky = int(MAX_CHALKY_RATIO * total)
        if counts["chalky"] > max_chalky:
            excess = counts["chalky"] - max_chalky
            counts["chalky"] -= excess
            counts["good"] += excess

    return AnalysisResult(
        total_grains=total,
        good_grains=counts["good"],
        broken_grains=counts["broken"],
        foreign_matter=counts["foreign"],
        chalky_grains=counts["chalky"],
        avg_grain_length_mm=round(np.median(lengths_mm), 2) if lengths_mm else CLAMP_LENGTH_MM_MIN,
        avg_grain_width_mm=round(np.median(widths_mm), 2) if widths_mm else CLAMP_WIDTH_MM_MIN,
        note="Measurements are estimated. Foreign detection limited to trained objects."
    )

# ======================
# API
# ======================
@app.post("/analyze", response_model=AnalysisResult)
async def analyze(request: Request, file: UploadFile = File(...)):
    rid = request.state.request_id
    if not file.content_type.startswith("image/"):
        raise HTTPException(415, {"error": "unsupported_media_type", "request_id": rid})

    img = await file.read()
    if not img:
        raise HTTPException(400, {"error": "empty_file", "request_id": rid})

    try:
        return await asyncio.wait_for(
            asyncio.to_thread(analyze_with_roboflow, img),
            timeout=TIMEOUT
        )
    except asyncio.TimeoutError:
        raise HTTPException(504, {"error": "roboflow_timeout", "request_id": rid})
    except ValueError:
        raise HTTPException(400, {"error": "invalid_image", "request_id": rid})
    except Exception:
        logger.exception("Unhandled error")
        raise HTTPException(500, {"error": "internal_error", "request_id": rid})

@app.get("/health")
def health():
    return {"status": "ok"}


@app.get("/test")
def test():
    return {"status": "backend running"}
