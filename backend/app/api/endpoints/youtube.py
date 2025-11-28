from fastapi import APIRouter, HTTPException
import requests
from app.core.config import YOUTUBE_API_KEY

router = APIRouter()

@router.get("/youtube/search")
async def search_youtube(q: str):
    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=500, detail="YouTube API Key not configured")
    
    try:
        url = "https://www.googleapis.com/youtube/v3/search"
        params = {
            "part": "snippet",
            "maxResults": 12,
            "q": q,
            "type": "video",
            "key": YOUTUBE_API_KEY
        }
        response = requests.get(url, params=params)
        if response.status_code != 200:
             error_msg = response.json().get("error", {}).get("message", "YouTube API Error")
             raise HTTPException(status_code=response.status_code, detail=error_msg)
        
        return response.json()
    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"YouTube Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
