from fastapi import APIRouter, HTTPException, UploadFile, File
import shutil
import uuid
import os
from google import genai
from google.genai import types
from app.core.config import GOOGLE_API_KEY

router = APIRouter()

if GOOGLE_API_KEY:
    client = genai.Client(api_key=GOOGLE_API_KEY)

@router.post("/asr")
async def asr(file: UploadFile = File(...)):
    if not GOOGLE_API_KEY:
        raise HTTPException(status_code=500, detail="Google API Key not configured")
    
    try:
        # Save uploaded file temporarily
        temp_filename = f"temp_{uuid.uuid4()}.wav"
        with open(temp_filename, "wb") as buffer:
            shutil.copyfileobj(file.file, buffer)
            
        try:
            # Upload to Gemini using the new SDK client
            if client:
                with open(temp_filename, "rb") as f:
                    audio_bytes = f.read()

                # Generate content
                response = client.models.generate_content(
                    model="gemini-2.5-flash-lite",
                    contents=[
                        types.Part.from_bytes(
                            data=audio_bytes,
                            mime_type="audio/wav"
                        ),
                        "Transcribe this audio exactly as spoken. Do not add any other text."
                    ]
                )
                return {"text": response.text}
            else:
                 raise HTTPException(status_code=500, detail="Gemini Client not initialized")
            
        finally:
            # Clean up local file
            if os.path.exists(temp_filename):
                os.remove(temp_filename)
                
    except Exception as e:
        print(f"ASR Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
