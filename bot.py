import asyncio
import os
import sys
import time
import requests
import discord
from discord.ext import commands, tasks
from dotenv import load_dotenv

load_dotenv()

DISCORD_TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))

intents = discord.Intents.default()
intents.members = True
intents.presences = True
intents.guilds = True
intents.voice_states = True
intents.message_content = True
intents.reactions = True


class MyBot(commands.Bot):
    def __init__(self):
        super().__init__(
            command_prefix="!",
            intents=intents
        )

    async def setup_hook(self):
        await self.load_extension("cogs.chat")
        await self.load_extension("cogs.reminders")
        await self.load_extension("cogs.welcome")
        await self.load_extension("cogs.logs")
        await self.load_extension("cogs.moderation")
        await self.load_extension("cogs.activity")
        await self.load_extension("cogs.status")
        await self.load_extension("cogs.notifications")

        guild = discord.Object(id=GUILD_ID)
        
        # Copy to guild
        self.tree.copy_global_to(guild=guild)
        await self.tree.sync(guild=guild)

        print("-> Slash commands mapped exclusively to guild")


bot = MyBot()


@bot.tree.command(name="ping", description="Check bot latency")
async def ping(interaction: discord.Interaction):
    # Simulate thinking for animation feel
    await interaction.response.defer(thinking=True)
    await asyncio.sleep(0.6)
    
    latency = round(bot.latency * 1000)
    
    status_str = "🟢 Online"
    color = 0x57F287
    
    if latency > 200:
        color = 0xED4245
        status_str = "🔴 Delayed"
    elif latency > 100:
        color = 0xFEE75C
        status_str = "🟡 Stable"

    embed = discord.Embed(
        title="🏓 IND Blades Status",
        description=(
            f"**Bot Latency:** `{latency}ms`\n"
            f"**API Health:** `Stable`\n"
            f"**System State:** {status_str}"
        ),
        color=color
    )
    
    avatar_url = bot.user.display_avatar.url if bot.user else None
    embed.set_footer(text="IND Blades • Premium SaaS Dashboard", icon_url=avatar_url)
    embed.timestamp = discord.utils.utcnow()
    
    await interaction.followup.send(embed=embed)


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")
    guild = bot.get_guild(GUILD_ID)
    if guild:
        try:
            print(f"-> Prefetching ALL members for guild: {guild.name.encode('ascii', 'ignore').decode('ascii')}")
        except:
            print(f"-> Prefetching ALL members for guild ID: {guild.id}")
        try:
            # Replaced deprecated .flatten() with async iteration for v2+ compatibility
            async for _ in guild.fetch_members(limit=None):
                pass
            print(f"-> Members loaded: {len(guild.members)}")
            # Notify backend
            send_heartbeat(True)
        except Exception as e:
            print(f"-> Failed to fetch members: {e}")
    
    if not heartbeat_task.is_running():
        try:
            heartbeat_task.start()
        except:
            pass
    print("Bot is ready and synced")

async def send_heartbeat_async(connected: bool):
    import aiohttp
    try:
        port = os.getenv("PORT", "3001")
        async with aiohttp.ClientSession() as session:
            async with session.post(f"http://127.0.0.1:{port}/api/bot/heartbeat", json={"connected": connected}, timeout=5) as resp:
                pass
    except:
        pass

@tasks.loop(seconds=60)
async def heartbeat_task():
    await send_heartbeat_async(True)

def is_already_running():
    import socket
    # Use a fixed port to lock the instance
    lock_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
    try:
        lock_socket.bind(('127.0.0.1', 4567))
        # Keep the socket open to hold the lock
        return lock_socket
    except socket.error:
        return None

if __name__ == "__main__":
    lock = is_already_running()
    if not lock:
        print("[CRITICAL] Another bot instance is already running. Exiting.")
        sys.exit(0)
        
    # Small delay to ensure server.js is ready
    time.sleep(5)
    print("Starting bot safety session (Managed by API)...")
    try:
        bot.run(DISCORD_TOKEN)
    except Exception as e:
        print(f"Bot session ended with error: {e}")
        try:
            import requests # Fallback to sync for exit
            port = os.getenv("PORT", "3001")
            requests.post(f"http://127.0.0.1:{port}/api/bot/heartbeat", json={"connected": False}, timeout=1)
        except:
            pass
        sys.exit(1) # Tell server.js we crashed so it can restart us after backoff
