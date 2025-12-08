from google import genai
import json
import random
from pathlib import Path
from app.core.config import GOOGLE_API_KEY
from app.models.room import AICompanion

client = genai.Client(api_key=GOOGLE_API_KEY)

COMPANIONS_DB_PATH = Path(__file__).parent.parent.parent / "companions_db.json"

def load_presets():
    if not COMPANIONS_DB_PATH.exists():
        return []
    try:
        with open(COMPANIONS_DB_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
            return [AICompanion(**item) for item in data]
    except Exception as e:
        print(f"Error loading companions: {e}")
        return []

async def generate_character_card(prompt: str) -> AICompanion:
    full_prompt = f"""
    你是一個充滿創意的角色生成器。請根據以下描述創建一個虛構的角色檔案："{prompt}"。
    
    請「僅」返回一個有效的 JSON 物件，包含以下欄位：
    - name: 角色名稱 (字串)
    - style: 角色在「陪看影片時」的行為風格描述 (字串)，使用繁體中文，30-50字。
    - catchphrase_1: 角色的第一句口頭禪或經典語錄 (字串，可選)，使用繁體中文。
    - catchphrase_2: 角色的第二句口頭禪或經典語錄 (字串，可選)，使用繁體中文。
    
    請勿包含任何 markdown 格式或解釋文字，只返回 JSON。
    """
    
    try:
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=full_prompt
        )
        text = response.text.strip()
        # Remove markdown code blocks if present
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        data = json.loads(text)
        
        # Generate a random avatar
        seed = data.get("name", "random") + str(random.randint(0, 1000))
        avatar = f"https://api.dicebear.com/9.x/bottts/svg?seed={seed}"
        
        return AICompanion(
            name=data.get("name", "Unknown"),
            style=data.get("style", "神秘的角色。"),
            catchphrase_1=data.get("catchphrase_1"),
            catchphrase_2=data.get("catchphrase_2"),
            avatar=avatar
        )
    except Exception as e:
        print(f"Error generating character: {e}")
        # Fallback
        return AICompanion(
            name="Glitch",
            style="無法預測、系統異常，像個出錯的程式。",
            catchphrase_1="錯誤...錯誤...系統異常...",
            catchphrase_2="ERROR 404: 口頭禪 not found",
            avatar="https://api.dicebear.com/9.x/bottts/svg?seed=Glitch"
        )

def get_presets():
    return load_presets()

async def generate_companion_response(companion_name: str, companion_style: str, user_name: str, user_input: str, context_type: str = "chat", video_context: str = None) -> str:
    prompt = f"""
    你是 {companion_name}。
    風格：{companion_style}
    
    當前情境：
    影片：{video_context or "目前沒有播放影片"}
    使用者：{user_name}
    
    事件：
    { "使用者傳送了訊息：" + user_input if context_type == "chat" else "使用者的情緒變成了：" + user_input }
    
    任務：
    回覆使用者或評論當前狀況。
    保持簡短（1-2 句話）。
    反應要即時且符合角色設定。
    請使用繁體中文。
    """
    
    try:
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Error generating response: {e}")
        return "..."

async def analyze_message(content: str, video_title: str = None, companions: list[AICompanion] = []) -> dict:
    """
    Analyze the message to detect spoilers and select the best companion to reply.
    Returns a dict with is_spoiler, reason, selected_companion, selection_reason.
    """
    companions_text = ""
    if companions:
        companions_text = "可用角色列表：\n" + "\n".join([f"- {c.name}: {c.style}" for c in companions])
    else:
        companions_text = "可用角色列表：無"

    prompt = f"""
    你是一個專業的劇情暴雷偵測員，同時也是一個對話分配系統。
    
    影片標題：{video_title or "無"}
    使用者訊息：{content}
    
    {companions_text}
    
    任務 1：判斷使用者的訊息是否包含該影片的關鍵劇情透漏（暴雷）。(如果沒有影片標題，則為 false)
    任務 2：根據使用者的訊息內容與語氣，從可用角色列表中選擇一位「最適合」回應的角色。
           請考慮角色的性格（style）與名字。
           如果沒有特別適合的角色，請隨機選擇一位。
           如果沒有可用角色，selected_companion 為 null。
    
    請「僅」返回一個有效的 JSON 物件，包含以下欄位：
    - is_spoiler: boolean (true/false)
    - reason: string (如果是暴雷，請說明原因，否則為 null)
    - selected_companion: string (被選中的角色名稱，或 null)
    - selection_reason: string (選擇該角色的原因)
    
    請勿包含任何 markdown 格式或解釋文字，只返回 JSON。
    """
    
    try:
        response = await client.aio.models.generate_content(
            model='gemini-2.5-flash-lite',
            contents=prompt
        )
        text = response.text.strip()
        # Remove markdown code blocks if present
        if text.startswith("```json"):
            text = text[7:]
        if text.startswith("```"):
            text = text[3:]
        if text.endswith("```"):
            text = text[:-3]
            
        data = json.loads(text)
        return {
            "is_spoiler": data.get("is_spoiler", False),
            "reason": data.get("reason"),
            "selected_companion": data.get("selected_companion"),
            "selection_reason": data.get("selection_reason")
        }
    except Exception as e:
        print(f"Error analyzing message: {e}")
        # Fallback: pick a random companion if available
        selected = random.choice(companions).name if companions else None
        return {
            "is_spoiler": False,
            "reason": None,
            "selected_companion": selected,
            "selection_reason": "Fallback due to error"
        }
