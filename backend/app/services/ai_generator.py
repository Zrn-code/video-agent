from google import genai
from google.genai import types
import json
import random
import os
import math
import isodate
import requests
from youtube_transcript_api import YouTubeTranscriptApi
from pathlib import Path
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
from app.core.config import (
    GOOGLE_API_KEY, 
    YOUTUBE_API_KEY,
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

def get_video_length(yt_id: str) -> float:
    try:
        url = f"https://www.googleapis.com/youtube/v3/videos?id={yt_id}&part=contentDetails&key={YOUTUBE_API_KEY}"
        response = requests.get(url)
        data = response.json()
        if 'items' in data and len(data['items']) > 0:
            duration = data['items'][0]['contentDetails']['duration']
            return isodate.parse_duration(duration).total_seconds()
        return 0.0
    except Exception as e:
        print(f"Error getting video length: {e}")
        return 0.0

def get_base_transcript(yt_id: str):
    print(f"Attempt to fetch base transcript for {yt_id}...")
    try:
        transcript_list = YouTubeTranscriptApi.list_transcripts(yt_id)
        # Try to find Chinese or English transcript
        try:
            transcript = transcript_list.find_transcript(['zh-TW', 'zh-CN', 'zh', 'en'])
        except:
            # If specific languages not found, try any manually created
            try:
                transcript = transcript_list.find_manually_created_transcript()
            except:
                # Fallback to any available
                transcript = next(iter(transcript_list))
                
        return transcript.fetch()
    except Exception as e:
        print(f"Error fetching base transcript: {e}")
        return None

def generate_transcript(yt_id: str) -> Optional[TranscriptDoc]:
    path = TRANSCRIPT_DIR / f"{yt_id}.json"
    if path.exists():
        return get_video_transcript(yt_id)

    base_transcript = get_base_transcript(yt_id)
    prompt = f"[Base Transcript]\n{json.dumps(base_transcript)}" if base_transcript else ""

    print(f"Generating video transcript for {yt_id}...")
    try:
        result = client.models.generate_content(
            model=GEMINI_MODEL_ANALYSIS,
            contents=[
                types.Content(
                    parts=[
                        types.Part(
                            file_data=types.FileData(
                                file_uri=f'https://www.youtube.com/watch?v={yt_id}'
                            )
                        ),
                        types.Part(
                            text=f"""
                            You are a professional Transcriber.
                            Process the audio file and generate a detailed transcription. {"Use the provided base transcript to help you." if base_transcript else ""}
                            
                            Requirements:
                            1. Identify distinct speakers (e.g., Speaker 1, Speaker 2, or names if context allows).
                            2. Provide accurate timestamps for each segment (Format: MM:SS).
                            3. Identify the primary emotion of the speaker in this segment.
                            4. Ignore screaming or noises.
                            
                            {prompt}
                            """
                        )
                    ]
                )
            ],
            config=types.GenerateContentConfig(
                response_mime_type="application/json",
                response_schema=TranscriptDoc,
                safety_settings=[
                    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
                ]
            ),
        )
        
        transcript = TranscriptDoc.model_validate_json(result.text)
        
        # Ensure directory exists
        TRANSCRIPT_DIR.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(transcript.model_dump(), f, ensure_ascii=False, indent=2)
            
        return transcript
    except Exception as e:
        print(f"Error generating transcript: {e}")
        return None

def generate_summary(yt_id: str) -> Optional[VideoLog]:
    path = SUMMARY_DIR / f"{yt_id}.json"
    if path.exists():
        return get_video_summary(yt_id)

    transcript_doc = generate_transcript(yt_id)
    if not transcript_doc:
        print("Cannot generate summary without transcript")
        return None
        
    transcript_list = transcript_doc.lines
    video_length = get_video_length(yt_id)
    chunk_size = 300
    chunks = math.ceil(video_length / chunk_size) if video_length > 0 else 1
    
    print(f"Splitting video {yt_id} into {chunks} chunks. (Total = {video_length}s)")
    summary_chunk: list[SceneLog] = []
    
    for n in range(chunks):
        start_time = n * chunk_size
        end_time = min((n + 1) * chunk_size, video_length)
        
        # Filter transcript for this chunk
        chunk_transcript = []
        for line in transcript_list:
            line_seconds = to_seconds(line.timestamp)
            if start_time <= line_seconds < end_time:
                chunk_transcript.append(line)
                
        transcript_text = json.dumps([line.model_dump() for line in chunk_transcript], ensure_ascii=False)
        
        try:
            result = client.models.generate_content(
                model=GEMINI_MODEL_ANALYSIS,
                contents=types.Content(parts=[
                    types.Part(
                        file_data=types.FileData(file_uri=f'https://www.youtube.com/watch?v={yt_id}'),
                        video_metadata=types.VideoMetadata(
                            start_offset=f"{int(start_time)}s",
                            end_offset=f"{int(end_time)}s"
                        )
                    ),
                    types.Part(text=f"""
                        You are a professional Continuity Supervisor for film. 
                        Your job is to create a frame-accurate LOG of the provided video clip and transcript.
                        
                        [Segment Transcript]
                        {transcript_text}
                        
                        **RULES:**
                        1. **Granularity:** Create a new entry every time the visual scene changes or the topic of conversation shifts (roughly every 10-20 seconds).
                        2. **Visuals:** Describe physical actions, colors, lighting, and background objects. Be specific.
                        3. **Audio:** Summarize the dialogue, but perform a "Grounding Check": Include a short direct quote for every entry.
                        4. **Vibe:** Analyze the mood.
                        5. **Trivia/Hooks:** Identify 1 specific detail a viewer might comment on.
                        
                        Return a list of SceneLog items.
                        """)
                ]),
                config=types.GenerateContentConfig(
                    response_mime_type="application/json",
                    response_schema=List[SceneLog],
                    temperature=0.0,
                    safety_settings=[
                        types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                        types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
                        types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                        types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
                    ]
                )
            )
            
            chunk_scenes = [SceneLog(**item) for item in json.loads(result.text)]
            summary_chunk.extend(chunk_scenes)
            
        except Exception as e:
            print(f"Error processing chunk {n}: {e}")

    print("Finished processing video chunks. Generating global summary...")
    try:
        result = client.models.generate_content(
            model=GEMINI_MODEL_ANALYSIS,
            contents=types.Content(parts=[
                types.Part(
                    text=f"""
                    [Summary]
                    {json.dumps([scene.model_dump() for scene in summary_chunk], ensure_ascii=False)}
                    [Transcript]
                    {json.dumps([line.model_dump() for line in transcript_list], ensure_ascii=False)}
                    """
                )
            ]),
            config=types.GenerateContentConfig(
                system_instruction="""
                You are a Video Content Summarizer. Synthesize the given scene summary and transcript into a coherent global summary.
                1. Summary: Write a 2-3 sentence 'Netflix-style' description.
                2. Themes: Extract key topics.
                3. Mood: Identify the overall vibe.
                """,
                temperature=0.0,
                response_mime_type="application/json",
                response_schema=GlobalSummary,
                safety_settings=[
                    types.SafetySetting(category="HARM_CATEGORY_HATE_SPEECH", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_DANGEROUS_CONTENT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_HARASSMENT", threshold="BLOCK_NONE"),
                    types.SafetySetting(category="HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold="BLOCK_NONE"),
                ]
            )
        )

        summary_global = GlobalSummary.model_validate_json(result.text)
        summary = VideoLog(global_summary=summary_global, segments=summary_chunk)
        
        # Ensure directory exists
        SUMMARY_DIR.mkdir(parents=True, exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(summary.model_dump(), f, ensure_ascii=False, indent=2)
            
        return summary
    except Exception as e:
        print(f"Error generating global summary: {e}")
        return None

async def process_video(yt_id: str):
    print(f"Starting processing for video {yt_id}")
    generate_transcript(yt_id)
    generate_summary(yt_id)
    print(f"Finished processing for video {yt_id}")

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


