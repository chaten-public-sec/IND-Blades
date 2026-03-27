import os
from datetime import datetime
from typing import Optional

import discord

SYSTEM_NAME = "IND Blades System"
SYSTEM_IDENTITY_LINE = "IND Blades Control System"
SYSTEM_TAGLINE = "I don't speak much. I act."
SYSTEM_VERSION = str(os.getenv("BOT_SYSTEM_VERSION", "v2.3")).strip() or "v2.3"

COLORS = {
    "info": 0x51A7FF,
    "success": 0x57F287,
    "warning": 0xFEE75C,
    "danger": 0xED4245,
    "accent": 0x5865F2,
}


def build_progress_bar(current: int, total: int, width: int = 6) -> str:
    safe_total = max(1, int(total or 1))
    ratio = max(0.0, min(1.0, float(current or 0) / safe_total))
    filled = max(0, min(width, round(ratio * width)))
    return f"[{'#' * filled}{'-' * (width - filled)}]"


def parse_datetime(value) -> Optional[datetime]:
    if isinstance(value, datetime):
        return value

    if value in (None, ""):
        return None

    if isinstance(value, (int, float)):
        try:
            return datetime.fromtimestamp(float(value), tz=discord.utils.utcnow().tzinfo)
        except Exception:
            return None

    try:
        return discord.utils.parse_time(str(value))
    except Exception:
        return None


def relative_timestamp(value, fallback: Optional[str] = None) -> Optional[str]:
    parsed = parse_datetime(value)
    if not parsed:
        return fallback
    return discord.utils.format_dt(parsed, style="R")


def system_footer(detail: Optional[str] = None) -> str:
    detail_text = str(detail or "").strip()
    return f"{SYSTEM_NAME} | {detail_text}" if detail_text else SYSTEM_NAME


def brand_embed(embed: discord.Embed, guild: Optional[discord.Guild] = None, detail: Optional[str] = None) -> discord.Embed:
    icon_url = guild.icon.url if guild and guild.icon else None
    embed.set_footer(text=system_footer(detail), icon_url=icon_url)
    if not embed.timestamp:
        embed.timestamp = discord.utils.utcnow()
    return embed


def action_feedback(kind: str = "info") -> str:
    mapping = {
        "success": "Override complete",
        "warning": "Node locked",
        "danger": "System override applied",
        "welcome": "Access granted",
        "info": "Control signal updated",
    }
    return mapping.get(kind, mapping["info"])
