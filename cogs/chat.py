import discord
from discord.ext import commands
from utils.perplexity import generate_reply_async

class Chat(commands.Cog):
    def __init__(self, bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot:
            return

        is_mention = self.bot.user in message.mentions
        is_reply = message.reference and isinstance(message.reference.resolved, discord.Message) and \
                   message.reference.resolved.author.id == self.bot.user.id

        if not (is_mention or is_reply):
            return

        async with message.channel.typing(): 
            reply_text = await generate_reply_async(message.content)
            await message.reply(reply_text, mention_author=True)  

async def setup(bot):
    await bot.add_cog(Chat(bot))
