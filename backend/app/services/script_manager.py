import json
import os
import asyncio
from typing import Dict, List, Optional, Tuple
from app.models.room import RoomInternal, Message
from app.services.connection_manager import manager
from datetime import datetime
import uuid

class ScriptManager:
    def __init__(self):
        self.scripts: Dict[str, List[Dict]] = {} # key: video_id, value: list of events
        self.script_path = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "character_emotions")

    def load_scripts(self):
        self.scripts = {}
        if not os.path.exists(self.script_path):
            print(f"Script path not found: {self.script_path}")
            return

        # Structure: character_emotions/VideoID/CompanionID.json
        for video_id in os.listdir(self.script_path):
            video_dir = os.path.join(self.script_path, video_id)
            if not os.path.isdir(video_dir):
                continue
            
            for file in os.listdir(video_dir):
                if file.endswith(".json"):
                    try:
                        companion_id = os.path.splitext(file)[0]
                        file_path = os.path.join(video_dir, file)
                        
                        with open(file_path, 'r', encoding='utf-8') as f:
                            events = json.load(f)
                        
                        processed_events = []
                        for event in events:
                            time_str = event.get("time")
                            if not time_str:
                                continue
                            
                            try:
                                minutes, seconds = map(int, time_str.split(':'))
                                time_seconds = minutes * 60 + seconds
                                
                                processed_events.append({
                                    "time": time_seconds,
                                    "emoji": event.get("emoji"),
                                    "response": event.get("response"),
                                    "companion_id": companion_id
                                })
                            except ValueError:
                                print(f"Invalid time format in {file}: {time_str}")
                                continue
                        
                        if video_id not in self.scripts:
                            self.scripts[video_id] = []
                        self.scripts[video_id].extend(processed_events)
                        
                    except Exception as e:
                        print(f"Error loading script {file}: {e}")
        
        # Sort events by time for each video
        for video_id in self.scripts:
            self.scripts[video_id].sort(key=lambda x: x["time"])
        
        print(f"Loaded scripts for {len(self.scripts)} videos")
        for vid, events in self.scripts.items():
            print(f"  - Video {vid}: {len(events)} events")

    def has_script(self, video_id: str, companion_id: str) -> bool:
        if video_id not in self.scripts:
            return False
        
        for event in self.scripts[video_id]:
            if event.get("companion_id") == companion_id:
                return True
        return False

    def get_triggered_events(self, video_id: str, start_time: float, end_time: float) -> List[Dict]:
        if video_id not in self.scripts:
            return []
        
        triggered = []
        for event in self.scripts[video_id]:
            # Check if event time is within the range (start_time, end_time]
            if start_time < event["time"] <= end_time:
                triggered.append(event)
            
            # Optimization: since events are sorted, if we pass end_time, we can stop
            if event["time"] > end_time:
                break
                
        return triggered

    async def handle_triggered_events(self, room_id: str, room: RoomInternal, events: List[Dict], save_callback=None):
        if not events:
            return

        print(f"Handling {len(events)} events for room {room_id}")
        
        now = datetime.now().timestamp()
        
        # Initialize lastScriptTime if not present
        if not hasattr(room, 'lastScriptTime'):
            room.lastScriptTime = 0.0
            
        # Determine the start time for this batch of events
        # We want to ensure at least 1.0s gap from the LAST scheduled message
        # If the last message was long ago, we can start immediately (delay=0)
        next_slot = max(now, room.lastScriptTime + 1.0)
        
        triggered_count = 0
        
        for event in events:
            companion_id = event["companion_id"]
            print(f"  - Event for companion {companion_id} at {event['time']}s")
            
            # Check if companion is in the room
            companion_user = None
            for uid, user_info in room.users.items():
                if user_info.get("isAi") and user_info.get("id") == companion_id:
                    companion_user = (uid, user_info)
                    break
            
            if companion_user:
                print(f"    -> Found companion {companion_id} in room")
                uid, user_info = companion_user
                
                # Calculate start delay
                start_delay = max(0.0, next_slot - now)
                
                # Schedule the message with delay
                asyncio.create_task(self.send_scripted_message(room_id, uid, user_info, event, room, save_callback, start_delay=start_delay))
                
                # Update next slot for subsequent messages
                room.lastScriptTime = next_slot
                next_slot += 1.0
                
                triggered_count += 1
            else:
                print(f"    -> Companion {companion_id} NOT found in room")

    async def send_scripted_message(self, room_id: str, user_id: str, user_info: Dict, event: Dict, room: RoomInternal, save_callback=None, start_delay: float = 0.0):
        if start_delay > 0:
            await asyncio.sleep(start_delay)

        print(f"🎬 Script triggered for {user_info['username']} in room {room_id} at {event['time']}s")
        
        # Set emotion to '💬' to indicate typing/thinking and prevent random emoji override
        user_info["emotion"] = "💬"
        user_info["lastSeen"] = datetime.now().timestamp()
        
        await manager.broadcast({
            "type": "users_update",
            "users": [
                {
                    "id": u_id,
                    "username": u_info['username'],
                    "avatar": u_info['avatar'],
                    "lastSeen": u_info['lastSeen'],
                    "emotion": u_info.get('emotion'),
                    "isAi": u_info.get('isAi', False),
                    "addedBy": u_info.get('addedBy'),
                    "addedByUsername": u_info.get('addedByUsername'),
                    "hasScript": u_info.get('hasScript', False)
                }
                for u_id, u_info in room.users.items()
            ]
        }, room_id)

        # Delay 1.5 seconds (reduced from 3)
        await asyncio.sleep(1.5)
        
        # Re-check if user is still in room? Maybe not strictly necessary for this feature but good practice.
        # Also check if video is still playing? The user said "when video plays to corresponding time", 
        # if user pauses during the 3s delay, should it still send? Probably yes.
        
        message_content = event["response"]
        # You might want to prepend emoji or handle it separately. 
        # The script has "emoji" field. Maybe update user emotion?
        
        if event.get("emoji"):
            # Update emotion
            user_info["emotion"] = event["emoji"]
        else:
            # Clear the '💬' if no specific emoji
            user_info["emotion"] = None
            
        user_info["lastSeen"] = datetime.now().timestamp()
        user_info["lastSpokenAt"] = datetime.now().timestamp()
        
        # Broadcast emotion update
        await manager.broadcast({
            "type": "users_update",
            "users": [
                {
                    "id": u_id,
                    "username": u_info['username'],
                    "avatar": u_info['avatar'],
                    "lastSeen": u_info['lastSeen'],
                    "emotion": u_info.get('emotion'),
                    "isAi": u_info.get('isAi', False),
                    "addedBy": u_info.get('addedBy'),
                    "addedByUsername": u_info.get('addedByUsername'),
                    "hasScript": u_info.get('hasScript', False)
                }
                for u_id, u_info in room.users.items()
            ]
        }, room_id)

        # Create and send message
        now = datetime.now().timestamp()
        video_title = room.currentVideo.title if room.currentVideo else None
        
        message = Message(
            id=str(uuid.uuid4()),
            userId=user_id,
            username=user_info["username"],
            content=message_content,
            timestamp=now,
            videoTitle=video_title,
            videoTimestamp=event["time"]
        )
        
        room.messages.append(message)
        # We should probably save room state, but doing it from async task might be race-condition prone 
        # if not careful. However, room_manager.rooms is in-memory.
        # To be safe, we can just append to memory. Saving to disk happens frequently enough or we can trigger it.
        
        await manager.broadcast({
            "type": "new_message",
            "message": message.dict()
        }, room_id)
        
        if save_callback:
            save_callback()
        
        # Clear emotion after 3 seconds
        if event.get("emoji"):
            await asyncio.sleep(3)
            if user_info.get("emotion") == event["emoji"]:
                user_info["emotion"] = None
                await manager.broadcast({
                    "type": "users_update",
                    "users": [
                        {
                            "id": u_id,
                            "username": u_info['username'],
                            "avatar": u_info['avatar'],
                            "lastSeen": u_info['lastSeen'],
                            "emotion": u_info.get('emotion'),
                            "isAi": u_info.get('isAi', False),
                            "addedBy": u_info.get('addedBy'),
                            "addedByUsername": u_info.get('addedByUsername'),
                            "hasScript": u_info.get('hasScript', False)
                        }
                        for u_id, u_info in room.users.items()
                    ]
                }, room_id)

script_manager = ScriptManager()
