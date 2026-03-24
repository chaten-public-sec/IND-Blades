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
            except Exception as error:
                print(f"[ERROR] Failed to send DM to {user_id}: {error}")

    async def send_target_strike_dm(self, member: discord.Member, count: int, details: dict):
        reason = str(details.get("reason") or "No reason provided")
        issued_by_name = str(details.get("issued_by_name") or "Management")
        issued_by_role = str(details.get("issued_by_role") or "").replace("_", " ").title()
        expires_at = details.get("expires_at")
        violation_time = details.get("violation_time")
        proof_links = details.get("proof_links") or []
        witness_text = str(details.get("witness_text") or "").strip()

        embed = discord.Embed(title="Strike Issued", color=0xED4245)
        embed.description = (
            "You have received a strike in IND Blades.\n"
            "Please review the details below."
        )
        embed.add_field(name="Reason", value=reason[:1024], inline=False)
        embed.add_field(name="Given By", value=issued_by_name[:1024], inline=True)
        embed.add_field(name="Total Active Strikes", value=str(count), inline=True)

        if issued_by_role:
            embed.add_field(name="Issuer Role", value=issued_by_role[:1024], inline=True)
        if violation_time:
            embed.add_field(name="Violation Time", value=str(violation_time)[:1024], inline=False)
        if expires_at:
            embed.add_field(name="Expiry", value=str(expires_at)[:1024], inline=False)
        if witness_text:
            embed.add_field(name="Notes", value=witness_text[:1024], inline=False)
        if proof_links:
            formatted_links = "\n".join(str(link) for link in proof_links[:5])
            embed.add_field(name="Proof", value=formatted_links[:1024], inline=False)

        embed.set_footer(text="IND Blades | Strike Notice")
        embed.timestamp = discord.utils.utcnow()

        try:
            if member.dm_channel is None:
                await member.create_dm()
            await member.dm_channel.send(embed=embed)
        except Exception as error:
            print(f"[ERROR] Failed to send strike DM to {member.id}: {error}")

    @commands.Cog.listener()
    async def on_strike_updated(self, guild, member, count, action_type, details=None):
        if action_type == "sync":
            return

        title = "System Dispatch: Strike Update"
        color = 0xED4245 if action_type == "added" else 0x51A7FF

        embed = discord.Embed(title=title, color=color)
        embed.description = f"A strike action has been processed for **{member.name}**."
        embed.add_field(name="Target Member", value=member.mention, inline=True)
        embed.add_field(name="Action", value=action_type.capitalize(), inline=True)
        embed.add_field(name="Total Active Strikes", value=str(count), inline=True)
        embed.set_footer(text="IND Blades | Smart System")
        embed.timestamp = discord.utils.utcnow()

        await self.notify_users(guild, embed)

        if action_type == "added":
            await self.send_target_strike_dm(member, count, details or {})

    @commands.Cog.listener()
    async def on_event_state_change(self, guild, reminder, action_text, actor=None):
        title = "System Dispatch: Event Log"
        embed = discord.Embed(title=title, color=0x34D399)

        embed.description = f"**{action_text}**"
        embed.add_field(name="Event Name", value=reminder.get("desc", "Untitled"), inline=False)
        embed.add_field(name="Time (IST)", value=reminder.get("time", "Not set"), inline=True)
        embed.add_field(name="Author", value=actor.mention if actor else "System", inline=True)

        embed.set_footer(text="IND Blades | Smart System")
        embed.timestamp = discord.utils.utcnow()

        await self.notify_users(guild, embed)

    @commands.Cog.listener()
    async def on_event_channel_change(self, guild, reminder, old_id, new_id, actor):
        title = "System Dispatch: Routing Update"
        embed = discord.Embed(title=title, color=0xFBBF24)

        embed.description = f"Target routing updated for **{reminder.get('desc', 'Untitled')}**."
        embed.add_field(name="Original Channel", value=f"<#{old_id}>", inline=True)
        embed.add_field(name="Target Channel", value=f"<#{new_id}>", inline=True)
        embed.add_field(name="Author", value=actor.mention, inline=True)

        embed.set_footer(text="IND Blades | Smart System")
        embed.timestamp = discord.utils.utcnow()

        await self.notify_users(guild, embed)


async def setup(bot: commands.Bot):
    await bot.add_cog(Notifications(bot))
