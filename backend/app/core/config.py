import os
from dotenv import load_dotenv

load_dotenv()

GOOGLE_API_KEY = os.getenv("GOOGLE_API_KEY")
YOUTUBE_API_KEY = os.getenv("YOUTUBE_API_KEY")
HUME_API_KEY = os.getenv("HUME_API_KEY", "eZvL7EC04lAggjcXKHzdEStuFFwPkaUGa7F0ONgNcLP57fc6")

# Model Configuration
# Default model if not specified
GEMINI_MODEL_DEFAULT = os.getenv("GEMINI_MODEL_NAME", "gemini-2.5-flash-lite")

# Specific function models (default to GEMINI_MODEL_DEFAULT if not set)
GEMINI_MODEL_CHARACTER_CREATE = os.getenv("GEMINI_MODEL_CHARACTER_CREATE", GEMINI_MODEL_DEFAULT)
GEMINI_MODEL_ANALYSIS = os.getenv("GEMINI_MODEL_ANALYSIS", GEMINI_MODEL_DEFAULT) # For spoiler detection & routing
GEMINI_MODEL_SITUATION = os.getenv("GEMINI_MODEL_SITUATION", GEMINI_MODEL_DEFAULT) # For neutral reply & context
GEMINI_MODEL_CHAT = os.getenv("GEMINI_MODEL_CHAT", GEMINI_MODEL_DEFAULT) # For character responses
GEMINI_MODEL_ASR = os.getenv("GEMINI_MODEL_ASR", GEMINI_MODEL_DEFAULT) # For speech to text
