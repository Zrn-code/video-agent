from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import asyncio
import base64
import json
import websockets
from datetime import datetime

from app.services.connection_manager import manager
from app.services.room_manager import rooms
from app.core.config import HUME_API_KEY

router = APIRouter()

HUME_WS_URL = "wss://api.hume.ai/v0/stream/models"

EMOTION_TO_EMOJI = {
    "Admiration": "😍",
    "Adoration": "🥰",
    "Amusement": "😄",
    "Anger": "😠",
    "Anxiety": "😟",
    "Awe": "😮",
    "Awkwardness": "😬",
    "Boredom": "😐",
    "Calmness": "😌",
    "Confusion": "😕",
    "Contentment": "😊",
    "Desire": "🔥",
    "Disappointment": "😞",
    "Disgust": "🤢",
    "Distress": "😫",
    "Doubt": "🤔",
    "Embarrassment": "😳",
    "Empathic Pain": "😢",
    "Excitement": "😆",
    "Fear": "😱",
    "Joy": "😃",
    "Love": "❤️",
    "Sadness": "😢",
    "Surprise (negative)": "😮‍💨",
    "Surprise (positive)": "😲",
    "Sympathy": "🤗",
    "Tiredness": "😴",
    "Triumph": "🏆",
    "Pride": "😌",
    "Interest": "🤓",
    "Craving": "🤤",
    "Relief": "😅",
    "Shame": "😳",
}


def emotion_to_emoji(emotion_name: str) -> str:
    return EMOTION_TO_EMOJI.get(emotion_name, "")


@router.websocket("/ws/camera/{room_id}/{user_id}")
async def camera_websocket_endpoint(websocket: WebSocket, room_id: str, user_id: str):
    """
    處理來自前端的相機串流
    1. 接收前端傳來的 base64 圖片
    2. 轉發到 Hume AI 進行情緒分析
    3. 回傳 emoji 給前端
    """
    print(f"\n{'='*60}")
    print(f"📹 Camera WebSocket request from user {user_id} in room {room_id}")
    await websocket.accept()
    print(f"✅ WebSocket accepted")
    
    if room_id not in rooms:
        print(f"❌ Room {room_id} not found")
        await websocket.close(code=4000, reason="Room not found")
        return
    
    hume_ws = None
    
    try:
        # 建立與 Hume AI 的連接
        print(f"🔌 Connecting to Hume AI...")
        headers = [("X-Hume-Api-Key", HUME_API_KEY)]
        hume_ws = await websockets.connect(HUME_WS_URL, extra_headers=headers)
        print(f"✅ Hume AI connected")
        
        print(f"✅ Camera websocket fully connected for user {user_id} in room {room_id}")
        print(f"{'='*60}\n")
        
        frame_count = 0
        
        while True:
            # 接收來自前端的圖片數據
            data = await websocket.receive_json()
            print(f"📥 Received data type: {data.get('type')}")
            
            if data.get("type") == "camera_frame":
                frame_base64 = data.get("frame")
                
                if not frame_base64:
                    print(f"⚠️  Empty frame received")
                    continue
                
                print(f"📸 Processing frame, base64 length: {len(frame_base64)}")
                
                # 準備發送給 Hume AI 的 payload
                hume_payload = {
                    "data": frame_base64,
                    "models": {
                        "face": {}
                    },
                    "raw_text": False,
                    "payload_id": f"frame-{frame_count}"
                }
                
                # 發送到 Hume AI
                await hume_ws.send(json.dumps(hume_payload))
                
                # 接收 Hume AI 回應
                hume_response = await hume_ws.recv()
                hume_data = json.loads(hume_response)
                
                # 解析情緒並轉換為 emoji
                emotion_result = None
                
                if "face" in hume_data and hume_data["face"].get("predictions"):
                    emotions = hume_data["face"]["predictions"][0].get("emotions", [])
                    if emotions:
                        # 取得分數最高的情緒
                        top_emotion = max(emotions, key=lambda x: x["score"])
                        emotion_name = top_emotion["name"]
                        emoji = emotion_to_emoji(emotion_name)
                        
                        emotion_result = {
                            "emotion": emotion_name,
                            "emoji": emoji,
                            "score": top_emotion["score"]
                        }
                        
                        # 取前三高情緒
                        top3 = sorted(emotions, key=lambda x: x["score"], reverse=True)[:3]
                        emotion_result["top3"] = [
                            {
                                "emotion": e["name"],
                                "emoji": emotion_to_emoji(e["name"]),
                                "score": e["score"]
                            }
                            for e in top3
                        ]
                        
                        print(f"Frame {frame_count}: {emotion_name} {emoji} ({top_emotion['score']:.3f})")
                    else:
                        print(f"Frame {frame_count}: No emotions detected")
                else:
                    print(f"Frame {frame_count}: No face detected")
                
                # 回傳結果給前端
                response_data = {
                    "type": "emotion_result",
                    "result": emotion_result,
                    "frame_count": frame_count
                }
                print(f"Sending to client: {response_data}")
                await websocket.send_json(response_data)
                
                frame_count += 1
                
    except WebSocketDisconnect:
        print(f"\n🔌 Camera websocket disconnected for user {user_id}")
        print(f"{'='*60}\n")
    except Exception as e:
        print(f"\n❌ Error in camera websocket: {e}")
        print(f"Error type: {type(e).__name__}")
        import traceback
        print(f"Traceback: {traceback.format_exc()}")
        print(f"{'='*60}\n")
        try:
            await websocket.send_json({
                "type": "error",
                "message": str(e)
            })
        except:
            pass
    finally:
        if hume_ws:
            await hume_ws.close()
        try:
            await websocket.close()
        except:
            pass
