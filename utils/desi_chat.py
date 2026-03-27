import random
import re
from collections import defaultdict
from dataclasses import dataclass
from typing import Optional


CHAT_ALIASES = (
    "ind bot",
    "indbot",
    "blade bot",
    "blades bot",
    "ind blades",
    "oye bot",
    "bot bhai",
    "bot bhaiya",
)

GREETING_KEYWORDS = {
    "hi",
    "hello",
    "hey",
    "namaste",
    "ram ram",
    "salaam",
    "yo",
    "hola",
}
THANKS_KEYWORDS = {"thanks", "thank you", "thx", "ty", "shukriya", "dhanyavad"}
HYPE_KEYWORDS = {
    "raid",
    "scrim",
    "event",
    "match",
    "clan",
    "squad",
    "vc",
    "voice",
    "ready",
    "start",
    "game",
}
PRAISE_KEYWORDS = {"op", "goat", "legend", "fire", "mast", "crazy", "lit", "gg", "nice"}
ROAST_KEYWORDS = {"noob", "clown", "bakwas", "lodu", "pagal", "useless", "trash", "bevakuf"}
LOW_MOOD_KEYWORDS = {"sad", "tired", "low", "upset", "cry", "alone", "stress", "stressed"}


def normalize_text(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def trim_message(value: str, limit: int = 280) -> str:
    text = str(value or "").strip()
    if len(text) <= limit:
        return text
    return text[: limit - 3].rstrip() + "..."


@dataclass
class ChatPlan:
    response: str
    typing_delay: float
    reaction: Optional[str] = None


class DesiChatBrain:
    def __init__(self):
        self.channel_streak = defaultdict(int)
        self.last_user_by_channel = {}

    def should_engage(self, message, bot_user) -> bool:
        if not bot_user:
            return False

        if bot_user in message.mentions:
            return True

        reference = getattr(message, "reference", None)
        resolved = getattr(reference, "resolved", None)
        resolved_author = getattr(resolved, "author", None)
        if resolved_author and getattr(resolved_author, "id", None) == bot_user.id:
            return True

        lowered = normalize_text(message.content)
        return any(alias in lowered for alias in CHAT_ALIASES)

    def build_plan(self, message, bot_user_id: Optional[int] = None) -> ChatPlan:
        cleaned = self._clean_prompt(message.content, bot_user_id)
        lowered = normalize_text(cleaned)
        channel_id = getattr(message.channel, "id", "dm")
        author_id = getattr(message.author, "id", "user")
        message_id = getattr(message, "id", random.randint(10_000, 99_999))
        author_name = self._author_name(message)
        same_user_streak = self._remember(channel_id, author_id)

        rng = random.Random(f"{channel_id}:{author_id}:{message_id}:{lowered}")
        mood = self._detect_mood(lowered)
        opener = self._pick_opener(mood, same_user_streak, author_name, rng)
        closer = self._pick_closer(mood, author_name, rng)

        lines = [opener]
        if closer and closer != opener:
            lines.append(closer)

        response = trim_message("\n".join(line for line in lines if line))
        typing_delay = self._typing_delay(cleaned, response)
        reaction = self._pick_reaction(mood, rng)
        return ChatPlan(response=response, typing_delay=typing_delay, reaction=reaction)

    def _clean_prompt(self, content: str, bot_user_id: Optional[int]) -> str:
        text = str(content or "")
        if bot_user_id:
            text = re.sub(rf"<@!?{bot_user_id}>", "", text)
        return text.strip() or "bol kuch mast"

    def _author_name(self, message) -> str:
        raw_name = getattr(message.author, "display_name", None) or getattr(message.author, "name", "bhai")
        return str(raw_name).split()[0][:18] or "bhai"

    def _remember(self, channel_id, author_id) -> int:
        last_user = self.last_user_by_channel.get(channel_id)
        if last_user == author_id:
            self.channel_streak[channel_id] += 1
        else:
            self.channel_streak[channel_id] = 0
        self.last_user_by_channel[channel_id] = author_id
        return self.channel_streak[channel_id]

    def _detect_mood(self, lowered: str) -> str:
        if any(token in lowered for token in LOW_MOOD_KEYWORDS):
            return "support"
        if any(token in lowered for token in THANKS_KEYWORDS):
            return "thanks"
        if any(token in lowered for token in HYPE_KEYWORDS):
            return "hype"
        if any(token in lowered for token in ROAST_KEYWORDS):
            return "roast"
        if any(token in lowered for token in PRAISE_KEYWORDS):
            return "praise"
        if any(token in lowered for token in GREETING_KEYWORDS):
            return "greeting"
        if "?" in lowered or any(token in lowered for token in ("kya", "kaise", "kab", "scene", "why", "how", "when")):
            return "question"
        return "chaos"

    def _pick_opener(self, mood: str, same_user_streak: int, author_name: str, rng: random.Random) -> str:
        repeat_tag = ""
        if same_user_streak >= 1:
            repeat_tag = rng.choice(
                [
                    f"{author_name}, round {same_user_streak + 1} bhi shuru kar diya tune.",
                    f"{author_name}, tu fir aa gaya full lafda leke.",
                    f"{author_name}, lagta hai aaj teri energy full charge hai.",
                ]
            )

        options = {
            "greeting": [
                f"Aree {author_name}, desi control room full active hai.",
                f"Yo {author_name}, IND mood on hai bhai.",
                f"Namaste {author_name}, scene seedha bol.",
            ],
            "thanks": [
                f"Arre {author_name}, itna formal mat ho yaar.",
                f"{author_name}, apne logon me thank you nahi, seedha chai treat chalta hai.",
                f"{author_name}, bas vibe mast rakh, kaam ho gaya samajh.",
            ],
            "hype": [
                f"{author_name}, full josh me chalo, aaj lobby hilni chahiye.",
                f"Scene tight hai {author_name}, ab sirf entry maarni baaki hai.",
                f"{author_name}, aaj pura squad Bollywood climax mode me khele.",
            ],
            "praise": [
                f"{author_name}, aaj to tu full hero material lag raha hai.",
                f"Bhai {author_name}, swag check bilkul overpowered hai.",
                f"{author_name}, aaj tera scene seedha highlight reel wala hai.",
            ],
            "roast": [
                f"{author_name}, drama kam kar warna main attendance me 'overacting' likh dunga.",
                f"Ae {author_name}, clownery theek hai par throttle halka rakh.",
                f"{author_name}, itni bakchodi bhi health plan cover nahi karta.",
            ],
            "support": [
                f"{author_name}, thoda saans le, sab set ho jayega.",
                f"Aree {author_name}, tension ko itna VIP access mat de.",
                f"{author_name}, scene heavy ho to hum log saath me sambhal lenge.",
            ],
            "question": [
                f"{author_name}, sawaal sahi hai, mood aur sahi hai.",
                f"Aree {author_name}, seedha poocha hai to seedha sun.",
                f"{author_name}, scene ka short answer yeh raha.",
            ],
            "chaos": [
                f"{author_name}, tera message full masala packet nikla.",
                f"Aree {author_name}, vibe to kaafi cinematic chal rahi hai.",
                f"{author_name}, aaj chat ka thermostat tune hi phoda hai.",
            ],
        }

        base = rng.choice(options.get(mood, options["chaos"]))
        return f"{repeat_tag}\n{base}" if repeat_tag else base

    def _pick_closer(self, mood: str, author_name: str, rng: random.Random) -> str:
        options = {
            "greeting": [
                "Bol ab kya scene hai, chai pe discuss karte hue type kar.",
                "Seedha point pe aa, warna main khud plot twist bana dunga.",
                "Aaj ki gossip, plan ya lafda jo bhi hai, nikaal de.",
            ],
            "thanks": [
                "Bas yaad rakh, yahan service free hai lekin attitude premium hai.",
                "Credit baad me dena, pehle vibe maintain kar.",
                "Ab hasi aayi ho to ek mast line aur phek de.",
            ],
            "hype": [
                "Voice me ghuso aur energy ko full bass boost do.",
                "Aaj ka rule simple hai: entry tez, exit legendary.",
                "Jo bhi karo, boring bilkul mat hona.",
            ],
            "praise": [
                "Apna confidence low mat rakh, warna swag beizzati file kar dega.",
                "Aise hi chalte raho, haters ko buffering pe rakho.",
                "Aaj ki trophy naam pe pending hai, le jao.",
            ],
            "roast": [
                "Seedha reh, warna main tujhe meme archive me daal dunga.",
                "Ab hasi aa gayi ho to shanti se baith aur paani pi.",
                "Thoda tameez add kar, warna roast ka GST lag jayega.",
            ],
            "support": [
                "Agar aur bolna hai to bol, yahan sunne wale log present hain.",
                "Paani pi, break le, phir aaram se wapas aa.",
                "Low feel kar raha hai to solo mat reh, ping kar dena.",
            ],
            "question": [
                "Aur detail chahiye to pooch, main ghoom phir ke nahi bolunga.",
                "Agar scene aur uljha hua hai to next line me khol de.",
                "Short answer yehi tha, detailed cut bhi chahiye to bol.",
            ],
            "chaos": [
                "Waise vibe achchi hai, bas ab isko aur entertaining bana.",
                "Main ready hun, tu bas agla masala drop kar.",
                "Ab ya to punchline de, ya proper context de.",
            ],
        }
        return rng.choice(options.get(mood, options["chaos"]))

    def _pick_reaction(self, mood: str, rng: random.Random) -> Optional[str]:
        if rng.random() < 0.45:
            return None

        mapping = {
            "greeting": ["\U0001F44B", "\u2728"],
            "thanks": ["\U0001F91D", "\U0001F60C"],
            "hype": ["\U0001F525", "\u2694\ufe0f", "\U0001F624"],
            "praise": ["\U0001F60E", "\U0001F525"],
            "roast": ["\U0001F60F", "\U0001F928"],
            "support": ["\U0001FAC2", "\U0001F49B"],
            "question": ["\U0001FAE1", "\U0001F440"],
            "chaos": ["\U0001F635", "\U0001F336\ufe0f", "\U0001F3AD"],
        }
        return rng.choice(mapping.get(mood, mapping["chaos"]))

    def _typing_delay(self, prompt: str, response: str) -> float:
        base = 0.85 + (len(prompt) / 65) + (len(response) / 140)
        return max(0.9, min(4.2, round(base, 2)))
