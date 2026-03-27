import asyncio
import os
import sys
import time

import discord
from discord.ext import commands, tasks
from dotenv import load_dotenv

from utils.system_identity import (
    SYSTEM_IDENTITY_LINE,
    SYSTEM_TAGLINE,
    SYSTEM_VERSION,
    action_feedback,
    brand_embed,
    build_progress_bar,
)

load_dotenv()

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID", "0") or 0)
LOCAL_API_PORT = str(os.getenv("PORT", "3001")).strip() or "3001"

intents = discord.Intents.default()
intents.members = True
intents.presences = True
intents.guilds = True
intents.voice_states = True
intents.message_content = True
intents.reactions = True


class MyBot(commands.Bot):
    def __init__(self):
        super().__init__(command_prefix="!", intents=intents)
        self.runtime_state = {
            "presence_mode": "idle",
            "reply_tone": "friendly",
            "silent_mode": False,
            "identity_line": f"{SYSTEM_IDENTITY_LINE} | {SYSTEM_VERSION}",
            "tagline": SYSTEM_TAGLINE,
            "member_count": 0,
            "active_events": 0,
            "active_strikes": 0,
            "message_rate": 0,
            "uptime_seconds": 0,
            "profile_line": f"{SYSTEM_VERSION} | booting system",
            "current_presence_text": "Boot sequence",
            "current_presence_type": "watching",
            "last_presence_at": None,
        }

    def build_runtime_payload(self):
        state = self.runtime_state if isinstance(self.runtime_state, dict) else {}
        return {
            "presence_mode": str(state.get("presence_mode") or "idle"),
            "reply_tone": str(state.get("reply_tone") or "friendly"),
            "silent_mode": bool(state.get("silent_mode")),
            "identity_line": str(state.get("identity_line") or SYSTEM_IDENTITY_LINE),
            "tagline": str(state.get("tagline") or SYSTEM_TAGLINE),
            "member_count": int(state.get("member_count") or 0),
            "active_events": int(state.get("active_events") or 0),
            "active_strikes": int(state.get("active_strikes") or 0),
            "message_rate": int(state.get("message_rate") or 0),
            "uptime_seconds": int(state.get("uptime_seconds") or 0),
            "profile_line": str(state.get("profile_line") or ""),
            "current_presence_text": str(state.get("current_presence_text") or ""),
            "current_presence_type": str(state.get("current_presence_type") or "watching"),
            "last_presence_at": state.get("last_presence_at"),
        }

    async def publish_runtime_state(self, connected: bool):
        import aiohttp

        payload = {
            "connected": bool(connected),
            "runtime": self.build_runtime_payload(),
        }

        try:
            async with aiohttp.ClientSession() as session:
                async with session.post(
                    f"http://127.0.0.1:{LOCAL_API_PORT}/api/bot/heartbeat",
                    json=payload,
                    timeout=5,
                ):
                    pass
        except Exception:
            pass

    async def setup_hook(self):
        await self.load_extension("cogs.chat")
        await self.load_extension("cogs.reminders")
        await self.load_extension("cogs.welcome")
        await self.load_extension("cogs.logs")
        await self.load_extension("cogs.moderation")
        await self.load_extension("cogs.autorole")
        await self.load_extension("cogs.activity")
        await self.load_extension("cogs.status")
        await self.load_extension("cogs.notifications")

        if GUILD_ID:
            guild = discord.Object(id=GUILD_ID)
            self.tree.copy_global_to(guild=guild)
            await self.tree.sync(guild=guild)
            print("-> Slash commands mapped exclusively to guild")


bot = MyBot()


@bot.tree.command(name="ping", description="Check bot latency")
async def ping(interaction: discord.Interaction):
    await interaction.response.defer(thinking=True)
    await asyncio.sleep(0.6)

    latency = round(bot.latency * 1000)
    runtime = bot.build_runtime_payload()

    if latency <= 100:
        state_label = "Healthy"
        color = 0x57F287
    elif latency <= 200:
        state_label = "Stable"
        color = 0xFEE75C
    else:
        state_label = "Delayed"
        color = 0xED4245

    latency_fill = max(1, 6 - min(5, latency // 80))
    embed = discord.Embed(
        title=action_feedback("info"),
        description="Runtime diagnostics synced from the live bot node.",
        color=color,
    )
    embed.add_field(name="Latency", value=f"{latency} ms", inline=True)
    embed.add_field(name="System State", value=state_label, inline=True)
    embed.add_field(name="Presence", value=runtime.get("current_presence_text") or "Observing silently", inline=True)
    embed.add_field(name="Reply Tone", value=str(runtime.get("reply_tone") or "friendly").title(), inline=True)
    embed.add_field(name="Traffic", value=f"{runtime.get('message_rate', 0)} msgs/min", inline=True)
    embed.add_field(name="Signal", value=f"{build_progress_bar(latency_fill, 6)} live", inline=True)
    brand_embed(embed, interaction.guild, "Latency Probe")

    await interaction.followup.send(embed=embed)


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")
    guild = bot.get_guild(GUILD_ID) if GUILD_ID else (bot.guilds[0] if bot.guilds else None)
    if guild:
        try:
            print(f"-> Prefetching ALL members for guild: {guild.name.encode('ascii', 'ignore').decode('ascii')}")
        except Exception:
            print(f"-> Prefetching ALL members for guild ID: {guild.id}")
        try:
            async for _ in guild.fetch_members(limit=None):
                pass
            print(f"-> Members loaded: {len(guild.members)}")
        except Exception as error:
            print(f"-> Failed to fetch members: {error}")

    await bot.publish_runtime_state(True)

    if not heartbeat_task.is_running():
        try:
            heartbeat_task.start()
        except Exception:
            pass
    print("Bot is ready and synced")


@tasks.loop(seconds=60)
async def heartbeat_task():
    await bot.publish_runtime_state(True)


def is_already_running():
    import socket

    lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        lock_socket.bind(("127.0.0.1", 4567))
        return lock_socket
    except socket.error:
        return None


if __name__ == "__main__":
    lock = is_already_running()
    if not lock:
        print("[CRITICAL] Another bot instance is already running. Exiting.")
        sys.exit(0)

    time.sleep(5)
    print("Starting bot safety session (Managed by API)...")
    try:
        bot.run(DISCORD_TOKEN)
    except Exception as error:
        print(f"Bot session ended with error: {error}")
        try:
            import requests

            requests.post(
                f"http://127.0.0.1:{LOCAL_API_PORT}/api/bot/heartbeat",
                json={"connected": False},
                timeout=1,
            )
        except Exception:
            pass
        sys.exit(1)
