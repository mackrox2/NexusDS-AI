from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from database.mongodb import client

from routes.dataset import router as dataset_router
from routes.ai import router as ai_router
from routes.ml import router as ml_router
from routes.autopilot import router as autopilot_router
from auth import router as auth_router

app = FastAPI(
    title="NexusDS AI",
    version="1.0.0",
    description="AI Powered Data Science Platform"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router)
app.include_router(dataset_router)
app.include_router(ai_router)
app.include_router(ml_router)
app.include_router(autopilot_router)

@app.get("/")
def root():
    return {
        "success": True,
        "message": "NexusDS AI Backend is running",
        "version": "1.0.0"
    }

@app.get("/api/health")
def health():
    try:
        client.admin.command("ping")
        return {
            "success": True,
            "status": "healthy",
            "database": "connected"
        }
    except Exception as error:
        return {
            "success": False,
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(error)
        }

@app.get("/api/ml/health")
def ml_health():
    return {
        "success": True,
        "status": "ready",
        "message": "Machine Learning API is running"
    }
