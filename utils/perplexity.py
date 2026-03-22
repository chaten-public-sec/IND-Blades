import os
import aiohttp
import asyncio
import re

API_KEY = os.getenv("PERPLEXITY_API_KEY")
API_URL = "https://api.perplexity.ai/chat/completions"

HEADERS = {
    "Authorization": f"Bearer {API_KEY}",
    "Content-Type": "application/json"
}

SYSTEM_PROMPT = (
    "Tu ek full desi Discord bhai hai 😎, full swag ke saath. "
    "Reply short aur punchy 1–3 lines mein, casual Hinglish mein. "
    "Normal users ke saath friendly aur funny, mast casual vibe. "
    "Jo troll kare, unko mast roast kar, cheeky aur thodi light gaali (mild & funny). "
    "Abusive ya illegal advice mat dena, par naughty aur cheeky responses chalta hai. "
    "Good users ke saath chill aur praise kar, unko respect aur fun vibe de. "
    "Boring ya technical replies mat de. Short, relatable aur entertaining rakh. "
    "Kuch references ya [1][6] jaise unnecessary cheezein mat dal. "
    "Full desi swag aur attitude ke saath response de, mast aur crazy ban. "
    "Har reply mein thodi cheekiness + thodi risky humor daal, par over na kar."
)

async def generate_reply_async(message: str) -> str:
    payload = {
        "model": "sonar-pro",
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": message}
        ],
        "temperature": 0.85,  
        "max_tokens": 80     
    }

    try:
        async with aiohttp.ClientSession() as session:
            async with session.post(API_URL, headers=HEADERS, json=payload, timeout=60) as resp:
                if resp.status != 200:
                    return f"⚠️ API returned status {resp.status}"
                data = await resp.json()
                reply = data["choices"][0]["message"]["content"].strip()

                reply = re.sub(r"\[\d+\]", "", reply)

                reply = " ".join(reply.splitlines())

                sentences = re.split(r"(?<=[.!?]) +", reply)
                reply = " ".join(sentences[:3])

                return reply

    except asyncio.TimeoutError:
        return "⚠️ Perplexity API timed out."
    except Exception as e:
        print("❌ Perplexity API Error:", e)
        return "Bhai thoda issue aa gaya 😅 baad mein try karna."


