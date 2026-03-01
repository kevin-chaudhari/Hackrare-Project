"""
Vercel serverless entrypoint for RareSignal AI FastAPI backend.
Vercel looks for an `app` object in api/index.py.

The vercel.json routes /api/* → this file, so FastAPI receives the path
as-is (e.g. /api/patients).  We mount the existing app under the /api
prefix via a root_path so that docs, OpenAPI, etc. still work correctly.
"""
import sys
import os

# Make the project root importable so that `backend.*` imports work correctly
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from backend.main import app as _backend_app

# Wrap the backend app so it responds at /api/* paths that Vercel sends here.
# We create a new top-level ASGI app and mount the backend at /api.
app = FastAPI()

# Pass through CORS from backend config
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/api", _backend_app)
