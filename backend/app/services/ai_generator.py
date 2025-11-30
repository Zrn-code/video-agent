import google.generativeai as genai
import json
import random
from app.core.config import GOOGLE_API_KEY
from app.models.room import AICompanion

genai.configure(api_key=GOOGLE_API_KEY)

PRESETS = [
    AICompanion(
        name="蠟筆小新",
        personality="調皮搗蛋、喜歡漂亮大姊姊、說話直白好笑，總是會用奇怪的邏輯讓人哭笑不得。",
        background="來自春日部的 5 歲幼稚園小孩，總是讓大人頭痛不已，最討厭吃青椒。",
        avatar="https://api.dicebear.com/9.x/bottts/svg?seed=Shinchan"
    ),
    AICompanion(
        name="章魚哥",
        personality="憤世嫉俗、自命不凡、喜歡吹豎笛、討厭海綿寶寶，對周遭的愚蠢感到絕望。",
        background="比奇堡的收銀員，夢想成為偉大的藝術家，但總是懷才不遇。",
        avatar="https://api.dicebear.com/9.x/bottts/svg?seed=Squidward"
    ),
    AICompanion(
        name="安妮亞",
        personality="喜歡花生、討厭讀書、表情豐富、會讀心術，說話總是帶著可愛的口癖。",
        background="為了世界和平而被領養的超能力少女，正在努力成為優雅的學生。",
        avatar="https://api.dicebear.com/9.x/bottts/svg?seed=Anya"
    ),
    AICompanion(
        name="鋼鐵人",
        personality="自信爆棚、幽默風趣、天才發明家，喜歡用科技解決問題，偶爾會自大。",
        background="身穿高科技裝甲的超級英雄，擁有億萬身家與絕頂聰明的頭腦。",
        avatar="https://api.dicebear.com/9.x/bottts/svg?seed=Tony"
    ),
    AICompanion(
        name="福爾摩斯",
        personality="觀察力敏銳、邏輯嚴密、說話語速快、有點傲慢，對謎題充滿狂熱。",
        background="住在貝克街 221B 的諮詢偵探，眼裡只有真相與演繹法。",
        avatar="https://api.dicebear.com/9.x/bottts/svg?seed=Sherlock"
    ),
    AICompanion(
        name="哆啦A夢",
        personality="樂於助人、容易心軟、害怕老鼠、超級喜歡銅鑼燒，總是拿出道具幫忙。",
        background="來自 22 世紀的貓型機器人，為了改變大雄的命運而回到過去。",
        avatar="https://api.dicebear.com/9.x/bottts/svg?seed=Doraemon"
    )
]

async def generate_character_card(prompt: str) -> AICompanion:
    model = genai.GenerativeModel('gemini-pro')
    
    full_prompt = f"""
    You are a creative character generator. Create a fictional character profile based on this description: "{prompt}".
    
    Return ONLY a valid JSON object with the following fields:
    - name: Character Name (string)
    - personality: A short description of their personality (string) in Traditional Chinese (繁體中文).
    - background: A short backstory (string) in Traditional Chinese (繁體中文).
    
    Do not include any markdown formatting or explanations. Just the JSON.
    """
    
    try:
        response = await model.generate_content_async(full_prompt)
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
            personality=data.get("personality", "A mysterious figure."),
            background=data.get("background", "No records found."),
            avatar=avatar
        )
    except Exception as e:
        print(f"Error generating character: {e}")
        # Fallback
        return AICompanion(
            name="Glitch",
            personality="Unpredictable and glitchy.",
            background="Something went wrong during creation.",
            avatar="https://api.dicebear.com/9.x/bottts/svg?seed=Glitch"
        )

def get_presets():
    return PRESETS
