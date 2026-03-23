import os
import discord
from discord.ext import commands
from utils.storage import load_data

class Notifications(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    def get_notification_config(self):
        data = load_data()
        return data.get("__notifications__", {"enabled": False, "user_ids": []})

    async def notify_users(self, guild, embed):
        config = self.get_notification_config()
        if not config.get("enabled", False):
            return

        user_ids = config.get("user_ids", [])
        if not user_ids:
            return

        for user_id in user_ids:
            try:
                member = guild.get_member(int(user_id))
                if not member:
                    member = await guild.fetch_member(int(user_id))
                
                if member:
                    if member.dm_channel is None:
                        await member.create_dm()
                    await member.dm_channel.send(embed=embed)
            except Exception as e:
                print(f"[ERROR] Failed to send DM to {user_id}: {e}")

    @commands.Cog.listener()
    async def on_strike_updated(self, guild, member, count, action_type):
        """
        Triggered when a strike is added, removed or expired.
        """
        title = "🛡️ System Intelligence: Strike Update"
        color = 0xED4245 if action_type == "added" else 0x51A7FF
        
        embed = discord.Embed(title=title, color=color)
        embed.description = f"A strike action has been processed for **{member.name}**."
        embed.add_field(name="Target Member", value=member.mention, inline=True)
        embed.add_field(name="Action", value=action_type.capitalize(), inline=True)
        embed.add_field(name="Total Active Strikes", value=str(count), inline=True)
        embed.set_footer(text="IND Blades • Smart System")
        embed.timestamp = discord.utils.utcnow()
        
        await self.notify_users(guild, embed)

    @commands.Cog.listener()
    async def on_event_state_change(self, guild, reminder, action_text, actor=None):
        """
        Triggered when an event is created, updated, deleted, enabled, or disabled.
        """
        title = "📅 System Intelligence: Event Action"
        embed = discord.Embed(title=title, color=0x34D399) # Emerald-400
        
        embed.description = f"**{action_text}**"
        embed.add_field(name="Event Name", value=reminder.get("desc", "Untitled"), inline=False)
        embed.add_field(name="Time (IST)", value=reminder.get("time", "Not set"), inline=True)
        embed.add_field(name="Author", value=actor.mention if actor else "System", inline=True)
        
        embed.set_footer(text="IND Blades • Smart System")
        embed.timestamp = discord.utils.utcnow()
        
        await self.notify_users(guild, embed)

    @commands.Cog.listener()
    async def on_event_channel_change(self, guild, reminder, old_id, new_id, actor):
        """
        Triggered when an event's target channel is changed.
        """
        title = "📅 System Intelligence: Channel Routing"
        embed = discord.Embed(title=title, color=0xFBBF24) # Amber-400
        
        embed.description = f"Target routing updated for **{reminder.get('desc', 'Untitled')}**."
        embed.add_field(name="Original Channel", value=f"<#{old_id}>", inline=True)
        embed.add_field(name="Target Channel", value=f"<#{new_id}>", inline=True)
        embed.add_field(name="Author", value=actor.mention, inline=True)
        
        embed.set_footer(text="IND Blades • Smart System")
        embed.timestamp = discord.utils.utcnow()
        
        await self.notify_users(guild, embed)

async def setup(bot: commands.Bot):
    await bot.add_cog(Notifications(bot))
