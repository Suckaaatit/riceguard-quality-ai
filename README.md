# RiceGuard AI

## What this product guarantees

Accurate for:

- Chalky grain detection
- Good vs broken classification (heuristic-assisted)
- Average grain size in millimeters (calibrated)
- Batch quality comparison
- Sparse to medium density rice images
- ~50g rice when spread (recommended)

Estimated for:

- Dense piles (accuracy decreases due to overlap/merging)

## Core capture assumptions (state these in demos)

Capture guidelines:

- Grains should be spread with minimal overlap
- Same camera, same height, same surface for consistent calibration
- Dark matte background preferred
- For millimeter accuracy, camera setup must be consistent

Dimension note:

- Grain dimensions are computed from axis-aligned bounding boxes and the width is corrected using a morphological correction factor to compensate for rotation/box inflation.

## Project Structure

- `frontend/`: React + TypeScript (Vite)
- `backend/`: FastAPI + Roboflow Serverless Inference

## Development

### Backend

Create and activate a venv, then install:

```bash
pip install -r backend/requirements.txt
```

Run:

```bash
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Configure environment variables in `backend/.env` (do not commit it). Example (no secrets):

```bash
ROBOFLOW_API_URL=https://serverless.roboflow.com
ROBOFLOW_MODEL_ID=your-model/your-version
ROBOFLOW_TIMEOUT_SECONDS=60

PX_TO_MM=0.18

BROKEN_ASPECT_RATIO=1.45
BROKEN_MAX_LENGTH_MM=4.5
MIN_GRAIN_LENGTH_MM=3.5
MIN_GRAIN_WIDTH_MM=1.2
USE_MEDIAN_STATS=1
```

### Frontend

Install:

```bash
npm install
```

Run dev server:

```bash
npm run dev
```

The frontend proxies `/analyze` to `http://localhost:8000` via `vite.config.ts`.

## Production-like

Build frontend:

```bash
npm run build
```

Then run backend. If `frontend/dist` exists, FastAPI will serve it at `/`.
