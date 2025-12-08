#!/usr/bin/env python3
"""
修復房間資料庫，為 mock 用戶添加 isAi 標記，並設置正確的 createdAt 時間
"""
import json
from datetime import datetime

DB_FILE = "rooms_db.json"

def fix_rooms_db():
    try:
        with open(DB_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        now = datetime.now().timestamp()
        fixed_count = 0
        
        for room_id, room_data in data.items():
            # 跳過永久測試房間
            if room_id == "test-room-permanent":
                continue
            
            # 修復 createdAt
            if room_data.get('createdAt', 0) == 0.0:
                room_data['createdAt'] = now
                print(f"Fixed createdAt for room {room_id}")
                fixed_count += 1
            
            # 為所有 mock 用戶添加 isAi 標記
            users = room_data.get('users', {})
            for user_id, user_info in users.items():
                if user_id.startswith('mock-user-'):
                    if not user_info.get('isAi', False):
                        user_info['isAi'] = True
                        print(f"Added isAi flag to {user_id} in room {room_id}")
                        fixed_count += 1
            
            # 重置 lastRealUserSeenAt 如果房間只有 mock/AI 用戶
            has_real_users = any(
                not info.get('isAi', False) 
                for info in users.values()
            )
            
            if not has_real_users:
                room_data['lastRealUserSeenAt'] = 0.0
                print(f"Reset lastRealUserSeenAt for room {room_id} (no real users)")
                fixed_count += 1
        
        # 保存修復後的資料
        with open(DB_FILE, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        print(f"\n✅ Database fixed! Total fixes: {fixed_count}")
        print(f"📊 Total rooms: {len(data)}")
        
    except Exception as e:
        print(f"❌ Error fixing database: {e}")

if __name__ == "__main__":
    fix_rooms_db()
