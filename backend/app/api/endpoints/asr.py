from fastapi import APIRouter, HTTPException, UploadFile, File
import shutil
import uuid
import os
from google import genai
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
                uploaded_file = client.files.upload(path=temp_filename)
                
                # Generate content
                response = client.models.generate_content(
                    model="gemini-2.0-flash",
                    contents=[uploaded_file, "Transcribe this audio exactly as spoken. Do not add any other text."]
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
