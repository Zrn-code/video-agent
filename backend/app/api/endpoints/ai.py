from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import List
from app.services.ai_generator import generate_character_card, get_presets
from app.models.room import AICompanion

router = APIRouter()

class GenerateRequest(BaseModel):
    prompt: str

@router.post("/ai/generate", response_model=AICompanion)
async def generate_companion(request: GenerateRequest):
    if not request.prompt:
        raise HTTPException(status_code=400, detail="Prompt is required")
    return await generate_character_card(request.prompt)

@router.get("/ai/presets", response_model=List[AICompanion])
async def get_companion_presets():
    return get_presets()
