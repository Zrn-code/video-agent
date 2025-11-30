from fastapi import APIRouter, HTTPException
import requests
from app.core.config import YOUTUBE_API_KEY
import re

router = APIRouter()

def parse_duration(duration_str):
    """Parses ISO 8601 duration string to seconds."""
    match = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', duration_str)
    if not match:
        return 0
    h = int(match.group(1) or 0)
    m = int(match.group(2) or 0)
    s = int(match.group(3) or 0)
    return h * 3600 + m * 60 + s

@router.get("/youtube/search")
async def search_youtube(q: str):
    if not YOUTUBE_API_KEY:
        raise HTTPException(status_code=500, detail="YouTube API Key not configured")
    
    try:
        # 1. Search for videos
        search_url = "https://www.googleapis.com/youtube/v3/search"
        search_params = {
            "part": "snippet",
            "maxResults": 20, # Fetch more to allow for filtering
            "q": q,
            "type": "video",
            "key": YOUTUBE_API_KEY
        }
        search_response = requests.get(search_url, params=search_params)
        if search_response.status_code != 200:
             error_msg = search_response.json().get("error", {}).get("message", "YouTube API Error")
             raise HTTPException(status_code=search_response.status_code, detail=error_msg)
        
        search_data = search_response.json()
        video_ids = [item['id']['videoId'] for item in search_data.get('items', [])]
        
        if not video_ids:
            return {"items": []}

        # 2. Get video details (duration, live status)
        videos_url = "https://www.googleapis.com/youtube/v3/videos"
        videos_params = {
            "part": "contentDetails,snippet",
            "id": ",".join(video_ids),
            "key": YOUTUBE_API_KEY
        }
        videos_response = requests.get(videos_url, params=videos_params)
        if videos_response.status_code != 200:
            raise HTTPException(status_code=videos_response.status_code, detail="Failed to fetch video details")

        videos_data = videos_response.json()
        
        # 3. Filter videos
        filtered_items = []
        for item in videos_data.get('items', []):
            duration_str = item['contentDetails'].get('duration', 'PT0S')
            duration_seconds = parse_duration(duration_str)
            is_live = item['snippet'].get('liveBroadcastContent') != 'none'
            
            # Filter: > 5 minutes (300 seconds) and NOT live
            if duration_seconds > 300 and not is_live:
                # Transform to match search result structure expected by frontend
                filtered_items.append({
                    "id": { "videoId": item["id"] },
                    "snippet": item["snippet"],
                    "contentDetails": item["contentDetails"]
                })
        
        return {"items": filtered_items}

    except HTTPException as he:
        raise he
    except Exception as e:
        print(f"YouTube Search Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))
