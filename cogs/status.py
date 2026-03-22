import discord
from discord.ext import commands, tasks
import itertools

class Status(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.statuses = itertools.cycle([
            "⚔️ Mercy is not coded.",
            "🛡️ Defending IND Blades.",
            "📅 Managing Events.",
            "⚠️ Watching for Strikes.",
            "🔥 Built by IND Blades Team."
        ])

    async def cog_load(self):
        self.change_status.start()

    async def cog_unload(self):
        self.change_status.cancel()

    @tasks.loop(seconds=15)
    async def change_status(self):
        current_status = next(self.statuses)
        await self.bot.change_presence(
            activity=discord.Game(name=current_status)
        )

    @change_status.before_loop
    async def before_change_status(self):
        await self.bot.wait_until_ready()

async def setup(bot: commands.Bot):
    await bot.add_cog(Status(bot))
