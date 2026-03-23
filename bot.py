import asyncio
import os
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

        guild = discord.Object(id=GUILD_ID)
        
        # Copy to guild
        self.tree.copy_global_to(guild=guild)
        await self.tree.sync(guild=guild)

        print("-> Slash commands mapped exclusively to guild")


bot = MyBot()


@bot.tree.command(name="ping", description="Check bot latency")
async def ping(interaction: discord.Interaction):
    latency = round(bot.latency * 1000)
    
    status_str = "🟢 Online"
    color = 0x57F287
    
    if latency > 150:
        color = 0xED4245
        status_str = "🔴 Slow"
    elif latency > 80:
        color = 0xFEE75C
        status_str = "🟡 Degraded"

    embed = discord.Embed(
        title="🏓 IND Blades Status",
        description=(
            f"**Latency:** {latency}ms\n"
            f"**API:** Stable\n"
            f"**Status:** {status_str}"
        ),
        color=color
    )
    
    avatar_url = bot.user.display_avatar.url if bot.user else None
    embed.set_footer(text="IND Blades • Smart System", icon_url=avatar_url)
    embed.timestamp = discord.utils.utcnow()
    
    await interaction.response.send_message(embed=embed)


@bot.event
async def on_ready():
    print(f"Logged in as {bot.user}")
    guild = bot.get_guild(GUILD_ID)
    if guild:
        print(f"-> Prefetching ALL members for guild: {guild.name} ({GUILD_ID})")
        try:
            # Replaced cache reliance with full member fetch as per production spec
            members = await guild.fetch_members().flatten()
            print(f"-> Fetched {len(members)} members into cache")
            # Notify backend
            send_heartbeat(True)
        except Exception as e:
            print(f"-> Failed to fetch members: {e}")
    
    if not heartbeat_task.is_running():
        heartbeat_task.start()
    print("Bot is ready")

def send_heartbeat(connected: bool):
    try:
        # Get server port from env or default to 3001
        port = os.getenv("PORT", "3001")
        requests.post(f"http://127.0.0.1:{port}/api/bot/heartbeat", json={"connected": connected}, timeout=5)
    except:
        pass

@tasks.loop(seconds=60)
async def heartbeat_task():
    send_heartbeat(True)

if __name__ == "__main__":
    print("Starting bot safety loop...")
    while True:
        try:
            bot.run(DISCORD_TOKEN)
        except Exception as e:
            print(f"Bot crashed with error: {e}. Retrying in 30s...")
            send_heartbeat(False)
            time.sleep(30)
