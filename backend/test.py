from google import genai
from google.genai import types
import os
from dotenv import load_dotenv


load_dotenv("../.env")

client = genai.Client(
    api_key=os.getenv("GEMINI_API_KEY"),
    http_options=types.HttpOptions(api_version="v1")
)

response = client.models.generate_content(
    model="gemini-2.5-flash",  # or "gemini-2.0-flash-lite"
    contents="Say hello"
)


