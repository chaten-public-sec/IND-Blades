import os
import discord
from discord.ext import commands
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
        print(f"-> Prefetching members for guild: {guild.name} ({GUILD_ID})")
        try:
            # This ensures members are loaded into cache for the bot process
            await guild.fetch_members().flatten()
            print(f"-> Prefetched {len(guild.members)} members")
        except Exception as e:
            print(f"-> Failed to prefetch members: {e}")
    print("Bot is ready")


bot.run(DISCORD_TOKEN)
