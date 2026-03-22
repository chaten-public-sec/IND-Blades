import os
import discord
from discord.ext import commands
from dotenv import load_dotenv

load_dotenv()
TOKEN = os.getenv("DISCORD_TOKEN")
GUILD_ID = int(os.getenv("GUILD_ID"))

bot = commands.Bot(command_prefix="!", intents=discord.Intents.default())

@bot.event
async def on_ready():
    guild = discord.Object(id=GUILD_ID)

    for cmd in await bot.tree.fetch_commands(guild=guild):
        bot.tree.remove_command(cmd.name, type=cmd.type)

    for cmd in await bot.tree.fetch_commands():
        bot.tree.remove_command(cmd.name, type=cmd.type)

    await bot.tree.sync(guild=guild)
    await bot.tree.sync()
    print("✅ All old slash commands cleared.")
    await bot.close()

bot.run(TOKEN)

#Untree code
