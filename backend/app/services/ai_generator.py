from google import genai
from google.genai import types
import json
import random
import os
from pathlib import Path
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.core.config import (
    GOOGLE_API_KEY, 
    GEMINI_MODEL_CHARACTER_CREATE,
    GEMINI_MODEL_ANALYSIS,
    GEMINI_MODEL_SITUATION,
    GEMINI_MODEL_CHAT
)
from app.models.room import AICompanion

client = genai.Client(api_key=GOOGLE_API_KEY)

COMPANIONS_DB_PATH = Path(__file__).parent.parent.parent / "companions_db.json"
TRANSCRIPT_DIR = Path(__file__).parent.parent.parent / "transcript"
SUMMARY_DIR = Path(__file__).parent.parent.parent / "summary"

# --- Models ---

class SceneLog(BaseModel):
    start_time: str = Field(description="MM:SS")
    end_time: str = Field(description="MM:SS")
    visual_action: str = Field(description="Detailed description of physical movements and environment.")
    dialogue_summary: str = Field(description="What is being said.")
    grounding_quote: str = Field(description="A direct 3-5 word quote from the audio in this segment.")
    mood: str = Field(description="One word emotion.")
    commentary_hook: str = Field(description="A specific, interesting visual or audio detail suitable for a user to point out.")

class GlobalSummary(BaseModel):
    brief_summary: str = Field(description="A 2-3 sentence overview of the entire video.")
    key_themes: List[str] = Field(description="3-5 bullet points on the main topics or events.")
    overall_mood: str = Field(description="The dominant emotion of the video.")

class VideoLog(BaseModel):
    global_summary: GlobalSummary
    segments: List[SceneLog]

class DialogueLine(BaseModel):
    timestamp: str = Field(description="Time of speech in MM:SS format")
    speaker: str = Field(description="Name or descriptor (e.g., 'Speaker 1', 'John')")
    text: str = Field(description="Verbatim spoken words")
    tone: str = Field(description="Delivery style/emotion: Sarcastic, Shouting, Whispering, Deadpan, etc.")

class TranscriptDoc(BaseModel):
    lines: List[DialogueLine]

class SituationReport(BaseModel):
    event_trigger: str = Field(description="The specific visual or audio event the user is reacting to.")
    user_intent: str = Field(description="The user's emotional state or goal.")
    neutral_reply_draft: str = Field(description="A boring, factual, 1-sentence reply that addresses the user's comment accurately based on the video evidence.")
    suggested_angle: str = Field(description="Instruction for the persona on how to reply.")

# --- Helper Functions ---

def to_seconds(time_str: str) -> float:
    try:
        parts = time_str.split(':')
        if len(parts) == 2:
            return int(parts[0]) * 60 + float(parts[1])
        elif len(parts) == 3:
            return int(parts[0]) * 3600 + int(parts[1]) * 60 + float(parts[2])
        return 0.0
    except:
        return 0.0

def get_video_transcript(yt_id: str) -> Optional[TranscriptDoc]:
    path = TRANSCRIPT_DIR / f"{yt_id}.json"
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return TranscriptDoc(**data)
        except Exception as e:
            print(f"Error loading transcript for {yt_id}: {e}")
    return None

def get_video_summary(yt_id: str) -> Optional[VideoLog]:
    path = SUMMARY_DIR / f"{yt_id}.json"
    if path.exists():
        try:
            with open(path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                return VideoLog(**data)
        except Exception as e:
            print(f"Error loading summary for {yt_id}: {e}")
    return None

def get_current_context(timestamp: float, all_contexts: List[SceneLog]) -> Optional[SceneLog]:
    for scene in all_contexts:
        start = to_seconds(scene.start_time)
        end = to_seconds(scene.end_time)
        if start <= timestamp <= end:
            return scene
    return None

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
    You are a creative character generator. Please create a fictional character profile based on the following description: "{prompt}".
    
    Please return ONLY a valid JSON object with the following fields:
    - name: Character name, please use string. The name must use the same language as the prompt.
    - personalities: Character personalities. Please describe with less than 6 adjectives.
    - style: Describe character's speech habits. Please describe with less than 5 sentences.
    - language: Character's respond language, set to the main language used in user prompt.
    - catchphrase_1: Generate a phrase that the character might say when joyful using character's respond language. Generate within 2 sentences.
    - catchphrase_2: Generate a phrase that the character might say when sad using character's respond language. Generate within 2 sentences.
    
    Do not include any markdown formatting or explanatory text, just return the JSON.
    """
    
    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL_CHARACTER_CREATE,
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
        
        personalities = data.get("personalities")
        if isinstance(personalities, list):
            personalities = ", ".join(personalities)
        
        return AICompanion(
            name=data.get("name", "Unknown"),
            personalities=personalities,
            style=data.get("style", "神秘的角色。"),
            language=data.get("language", "Traditional Chinese"),
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

async def analyze_message_and_select_companions(
    content: str, 
    video_title: str = None, 
    companions: list[AICompanion] = []
) -> dict:
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
    任務 2：根據使用者的訊息內容與語氣，從可用角色列表中選擇「一位或多位」適合回應的角色。
           請考慮角色的性格（style）與名字。
           如果沒有特別適合的角色，請隨機選擇一位。
           如果沒有可用角色，selected_companions 為空陣列。
    
    請「僅」返回一個有效的 JSON 物件，包含以下欄位：
    - is_spoiler: boolean (true/false)
    - reason: string (如果是暴雷，請說明原因，否則為 null)
    - selected_companions: list[string] (被選中的角色名稱列表)
    - selection_reason: string (選擇這些角色的原因)
    
    請勿包含任何 markdown 格式或解釋文字，只返回 JSON。
    """
    
    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL_ANALYSIS,
            contents=prompt
        )
        text = response.text.strip()
        if text.startswith("```json"): text = text[7:]
        if text.startswith("```"): text = text[3:]
        if text.endswith("```"): text = text[:-3]
        
        return json.loads(text)
    except Exception as e:
        print(f"Error analyzing message: {e}")
        selected = [random.choice(companions).name] if companions else []
        return {
            "is_spoiler": False,
            "reason": None,
            "selected_companions": selected,
            "selection_reason": "Fallback due to error"
        }

async def get_neutral_reply(yt_id: str, user_msg: str, timestamp: float) -> SituationReport:
    transcript_doc = get_video_transcript(yt_id)
    video_log = get_video_summary(yt_id)
    
    current_scene = None
    recent_transcript = []
    
    if video_log:
        current_scene = get_current_context(timestamp, video_log.segments)
    
    if transcript_doc:
        # Get lines around timestamp (e.g., -10s to +5s)
        for line in transcript_doc.lines:
            t = to_seconds(line.timestamp)
            if timestamp - 30 <= t <= timestamp + 5:
                recent_transcript.append(line)

    # Construct context string
    context_str = ""
    if current_scene:
        context_str += f"[Current Scene]\nVisual: {current_scene.visual_action}\nDialogue: {current_scene.dialogue_summary}\nMood: {current_scene.mood}\n"
    
    if recent_transcript:
        context_str += "[Recent Transcript]\n" + "\n".join([f"{l.timestamp} {l.speaker}: {l.text} ({l.tone})" for l in recent_transcript])

    if not context_str:
        context_str = "No specific video context available."

    prompt = f"""
    You are a Video Companion Director.
    
    [Video Context at {timestamp}s]
    {context_str}
    
    [User Message]
    "{user_msg}"
    
    Analyze the user's comment against the video context.
    Generate a SituationReport in JSON format.
    """
    
    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL_SITUATION,
            contents=prompt,
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=SituationReport
            )
        )
        return SituationReport.model_validate_json(response.text)
    except Exception as e:
        print(f"Error generating neutral reply: {e}")
        return SituationReport(
            event_trigger="Unknown",
            user_intent="Unknown",
            neutral_reply_draft="I see.",
            suggested_angle="Be polite."
        )

async def generate_character_response(
    ch_name: str, 
    ch_personality: str, 
    ch_style: str, 
    user_name: str, 
    user_input: str, 
    situation: SituationReport,
    video_context_str: str
) -> str:
    prompt = f"""
    基本訊息：
    你是一個虛擬角色
    你的名字是{ch_name}
    你的人格特質為{ch_personality} (Style: {ch_style})

    當下情境：
    使用者名字是{user_name}
    你正在與使用者一同觀看影片
    影片此時的內容摘要：{video_context_str}
    
    使用者說：{user_input}
    
    分析報告：
    使用者意圖：{situation.user_intent}
    建議切入點：{situation.suggested_angle}
    參考中立回應：{situation.neutral_reply_draft}

    目標：
    請依照角色的人格特質對當下情境給出一段回應，回應時需考慮角色的說話習慣，使用繁體中文，不超過3句話。
    """

    try:
        response = await client.aio.models.generate_content(
            model=GEMINI_MODEL_CHAT,
            contents=prompt
        )
        return response.text.strip()
    except Exception as e:
        print(f"Error generating response for {ch_name}: {e}")
        return "..."

async def process_user_message_flow(
    user_name: str,
    user_content: str,
    video_id: str,
    video_title: str,
    video_timestamp: float,
    available_companions: List[AICompanion]
) -> dict:
    """
    Orchestrates the full flow:
    1. Analyze message (Spoiler & Selection)
    2. Generate neutral reply (Situation Report)
    3. Generate character responses
    """
    
    # Step 1
    analysis = await analyze_message_and_select_companions(user_content, video_title, available_companions)
    
    selected_names = analysis.get("selected_companions", [])
    selected_companions = [c for c in available_companions if c.name in selected_names]
    
    responses = []
    
    # Step 2
    situation = await get_neutral_reply(video_id, user_content, video_timestamp)
    
    # Step 3
    video_context_str = f"Event: {situation.event_trigger}. Neutral observation: {situation.neutral_reply_draft}"

    for companion in selected_companions:
        reply = await generate_character_response(
            ch_name=companion.name,
            ch_personality=companion.personalities or companion.style,
            ch_style=companion.style,
            user_name=user_name,
            user_input=user_content,
            situation=situation,
            video_context_str=video_context_str
        )
        responses.append({
            "companion_name": companion.name,
            "content": reply
        })
        
    return {
        "analysis": analysis,
        "situation": situation.dict(),
        "responses": responses
    }

# Legacy adapter
async def analyze_message(content: str, video_title: str = None, companions: list[AICompanion] = []) -> dict:
    result = await analyze_message_and_select_companions(content, video_title, companions)
    selected = result.get("selected_companions", [])
    return {
        "is_spoiler": result.get("is_spoiler", False),
        "reason": result.get("reason"),
        "selected_companion": selected[0] if selected else None,
        "selection_reason": result.get("selection_reason")
    }


