from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import threading
import asyncio

from app.api.endpoints import rooms, websocket, youtube, asr
from app.services.room_manager import update_mock_emotions

app = FastAPI()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # In production, replace with specific origins
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include Routers
app.include_router(rooms.router, prefix="/api")
app.include_router(websocket.router, prefix="/api")
app.include_router(youtube.router, prefix="/api")
app.include_router(asr.router, prefix="/api")

# Start background task for mock emotions
def run_async_task():
    asyncio.run(update_mock_emotions())

emotion_thread = threading.Thread(target=run_async_task, daemon=True)
emotion_thread.start()
