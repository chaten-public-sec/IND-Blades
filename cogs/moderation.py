import os
from datetime import timedelta

import discord
from discord import app_commands
from discord.ext import commands, tasks

from utils.storage import get_log_settings, load_data, save_data

DEFAULT_MODERATION_LOGS_CHANNEL_ID = int(os.getenv("MODERATION_LOGS_CHANNEL_ID", "0") or 0)


class Moderation(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    def resolve_log_channel(self, guild: discord.Guild):
        settings = get_log_settings()
        channel_id = settings.get("moderation_channel_id") or DEFAULT_MODERATION_LOGS_CHANNEL_ID
        if not channel_id or not settings.get("enabled", True):
            return None
        return guild.get_channel(int(channel_id))

    def mod_log_embed(self, action, moderator, target, reason=None, duration=None, strikes=None):
        embed = discord.Embed(title="Moderation Action", color=0xED4245)
        embed.add_field(name="Action", value=action, inline=False)
        embed.add_field(name="Moderator", value=moderator.mention if hasattr(moderator, 'mention') else str(moderator), inline=True)
        embed.add_field(name="Target", value=target.mention if hasattr(target, 'mention') else str(target), inline=True)
        if duration:
            embed.add_field(name="Duration", value=duration, inline=False)
        if strikes is not None:
            embed.add_field(name="Strikes", value=str(strikes), inline=True)
        embed.add_field(name="Reason", value=reason or "No reason provided", inline=False)
        embed.timestamp = discord.utils.utcnow()
        return embed

    def strike_embed(self, user, reason, strikes):
        embed = discord.Embed(title="⚠️ Strike Added", color=0xFEE75C)
        embed.add_field(name="User", value=user.mention, inline=True)
        embed.add_field(name="Reason", value=reason, inline=True)
        embed.add_field(name="Total Strikes", value=str(strikes), inline=True)
        embed.set_footer(text="IND Blades • Smart System")
        embed.timestamp = discord.utils.utcnow()
        return embed

    async def send_mod_log(self, guild, embed):
        channel = self.resolve_log_channel(guild)
        if channel:
            await channel.send(embed=embed)

    @commands.Cog.listener()
    async def on_check_event_attendance(self, guild, reminder):
        if not guild: return
        
        attending = set(reminder.get("attending", []))
        
        # Determine who should have attended
        target_type = reminder.get("target_type")
        target_id = reminder.get("target_id")
        
        eligible_users = []
        if target_type == "user":
            eligible_users = [target_id]
        elif target_type == "role":
            role = guild.get_role(int(target_id))
            if role:
                eligible_users = [str(m.id) for m in role.members if not m.bot]
        elif target_type == "channel":
            # For channel events, we might use a default role like FAMILY_ROLE_ID
            from cogs.reminders import FAMILY_ROLE_ID
            role = guild.get_role(FAMILY_ROLE_ID)
            if role:
                eligible_users = [str(m.id) for m in role.members if not m.bot]

        missed_users = [u_id for u_id in eligible_users if u_id not in attending]
        
        if not missed_users: return

        data = load_data()
        config = data.get("__strikes_config__", {"expiry_days": 7})
        expiry = config.get("expiry_days", 7)
        
        if "__strikes__" not in data: data["__strikes__"] = {}
        
        for user_id in missed_users:
            member = guild.get_member(int(user_id))
            if not member: continue
            
            if user_id not in data["__strikes__"]:
                data["__strikes__"][user_id] = {"user_id": user_id, "strikes": [], "strike_count": 0}
            
            reason = f"Missed Event: {reminder.get('desc')}"
            strike_entry = {
                "reason": reason,
                "timestamp": discord.utils.utcnow().isoformat(),
                "expires_at": (discord.utils.utcnow() + timedelta(days=expiry)).isoformat()
            }
            data["__strikes__"][user_id]["strikes"].append(strike_entry)
            data["__strikes__"][user_id]["strike_count"] = len(data["__strikes__"][user_id]["strikes"])
            count = data["__strikes__"][user_id]["strike_count"]
            
            # Send notification
            try:
                embed = self.strike_embed(member, reason, count)
                await self.send_mod_log(guild, self.mod_log_embed("Auto Strike", "System", member, reason, strikes=count))
                # Also try to DM or post in event channel? 
                # Let's post in event channel if it exists
                from cogs.reminders import REMINDER_CHANNEL_ID
                channel_id = reminder.get("channel_id") or REMINDER_CHANNEL_ID
                channel = guild.get_channel(int(channel_id))
                if channel:
                    await channel.send(embed=embed)
            except: pass
            
            self.bot.dispatch("strike_updated", guild, member, count, "added")

        save_data(data)

    @tasks.loop(hours=1)
    async def strike_expiry_check(self):
        data = load_data()
        if "__strikes__" not in data: return
        
        changed = False
        now = discord.utils.utcnow()
        
        for user_id, user_data in data["__strikes__"].items():
            original_count = len(user_data["strikes"])
            user_data["strikes"] = [s for s in user_data["strikes"] if discord.utils.parse_datetime(s["expires_at"]) > now]
            
            if len(user_data["strikes"]) != original_count:
                user_data["strike_count"] = len(user_data["strikes"])
                changed = True
                # Dispatch update for role sync
                guild = self.bot.get_guild(int(os.getenv("GUILD_ID")))
                if guild:
                    member = guild.get_member(int(user_id))
                    if member:
                        self.bot.dispatch("strike_updated", guild, member, user_data["strike_count"], "expired")

        if changed:
            save_data(data)

    async def cog_load(self):
        self.strike_expiry_check.start()

    async def cog_unload(self):
        self.strike_expiry_check.cancel()

    @app_commands.command(name="strike", description="Manage strikes")
    @app_commands.describe(
        action="Choose action: add, remove, config",
        user="User to manage strikes for",
        reason="Reason for the strike",
        expiry_days="Days until strike expires (config only)"
    )
    @app_commands.choices(action=[
        app_commands.Choice(name="Add Strike", value="add"),
        app_commands.Choice(name="Remove Latest", value="remove"),
        app_commands.Choice(name="Set Expiry", value="config")
    ])
    async def strike(
        self, 
        interaction: discord.Interaction, 
        action: str, 
        user: discord.Member = None, 
        reason: str = "No reason provided",
        expiry_days: int = None
    ):
        if not await self.permission_check(interaction, "moderate_members"):
            return

        data = load_data()
        
        if action == "config":
            if expiry_days is None:
                await interaction.response.send_message("Please provide expiry days.", ephemeral=True)
                return
            
            if "__strikes_config__" not in data:
                data["__strikes_config__"] = {}
            data["__strikes_config__"]["expiry_days"] = expiry_days
            save_data(data)
            await interaction.response.send_message(f"Strike expiry set to {expiry_days} days.")
            return

        if not user:
            await interaction.response.send_message("User is required for this action.", ephemeral=True)
            return

        if action == "add":
            config = data.get("__strikes_config__", {"expiry_days": 7})
            expiry = config.get("expiry_days", 7)
            
            if "__strikes__" not in data: data["__strikes__"] = {}
            user_id = str(user.id)
            if user_id not in data["__strikes__"]:
                data["__strikes__"][user_id] = {"user_id": user_id, "strikes": [], "strike_count": 0}
            
            strike_entry = {
                "reason": reason,
                "timestamp": discord.utils.utcnow().isoformat(),
                "expires_at": (discord.utils.utcnow() + timedelta(days=expiry)).isoformat()
            }
            data["__strikes__"][user_id]["strikes"].append(strike_entry)
            data["__strikes__"][user_id]["strike_count"] = len(data["__strikes__"][user_id]["strikes"])
            count = data["__strikes__"][user_id]["strike_count"]
            save_data(data)
            
            embed = self.strike_embed(user, reason, count)
            await interaction.response.send_message(embed=embed)
            await self.send_mod_log(interaction.guild, self.mod_log_embed("Strike Added", interaction.user, user, reason, strikes=count))
            self.bot.dispatch("strike_updated", interaction.guild, user, count, "added")

        elif action == "remove":
            user_id = str(user.id)
            if "__strikes__" not in data or user_id not in data["__strikes__"] or not data["__strikes__"][user_id]["strikes"]:
                await interaction.response.send_message("This user has no strikes.", ephemeral=True)
                return
            
            removed = data["__strikes__"][user_id]["strikes"].pop()
            data["__strikes__"][user_id]["strike_count"] = len(data["__strikes__"][user_id]["strikes"])
            count = data["__strikes__"][user_id]["strike_count"]
            save_data(data)
            
            await interaction.response.send_message(f"Removed latest strike from {user.mention}. Total strikes: {count}")
            await self.send_mod_log(interaction.guild, self.mod_log_embed("Strike Removed", interaction.user, user, f"Removed: {removed['reason']}", strikes=count))
            self.bot.dispatch("strike_updated", interaction.guild, user, count, "removed")

    async def permission_check(self, interaction: discord.Interaction, perm: str):
        if getattr(interaction.user.guild_permissions, perm):
            return True
        await interaction.response.send_message("You do not have permission to use this.", ephemeral=True)
        return False

    def hierarchy_check(self, interaction, member):
        return member.top_role < interaction.guild.me.top_role and member.top_role < interaction.user.top_role

    @app_commands.command(name="kick", description="Kick a member")
    async def kick(self, interaction: discord.Interaction, member: discord.Member, reason: str = None):
        if not await self.permission_check(interaction, "kick_members"):
            return
        if not self.hierarchy_check(interaction, member):
            await interaction.response.send_message("I cannot kick this member because of role order.", ephemeral=True)
            return

        await member.kick(reason=reason)
        await interaction.response.send_message(f"{member} has been kicked.")
        await self.send_mod_log(interaction.guild, self.mod_log_embed("Kick", interaction.user, member, reason))

    @app_commands.command(name="ban", description="Ban a member")
    async def ban(self, interaction: discord.Interaction, member: discord.Member, reason: str = None):
        if not await self.permission_check(interaction, "ban_members"):
            return
        if not self.hierarchy_check(interaction, member):
            await interaction.response.send_message("I cannot ban this member because of role order.", ephemeral=True)
            return

        await member.ban(reason=reason)
        await interaction.response.send_message(f"{member} has been banned.")
        await self.send_mod_log(interaction.guild, self.mod_log_embed("Ban", interaction.user, member, reason))

    async def banned_users_autocomplete(self, interaction: discord.Interaction, current: str):
        bans = [ban async for ban in interaction.guild.bans()]
        choices = []
        for ban in bans:
            user = ban.user
            label = f"{user.name}#{user.discriminator}"
            if current.lower() in label.lower():
                choices.append(app_commands.Choice(name=label, value=str(user.id)))
            if len(choices) >= 25:
                break
        return choices

    @app_commands.command(name="unban", description="Unban a member")
    @app_commands.autocomplete(user=banned_users_autocomplete)
    async def unban(self, interaction: discord.Interaction, user: str, reason: str = None):
        if not await self.permission_check(interaction, "ban_members"):
            return

        try:
            user_obj = await self.bot.fetch_user(int(user))
            await interaction.guild.unban(user_obj, reason=reason)
        except ValueError:
            await interaction.response.send_message("Invalid user.", ephemeral=True)
            return
        except discord.NotFound:
            await interaction.response.send_message("User not found or not banned.", ephemeral=True)
            return

        await interaction.response.send_message(f"{user_obj} has been unbanned.")
        await self.send_mod_log(interaction.guild, self.mod_log_embed("Unban", interaction.user, user_obj, reason))

    @app_commands.command(name="timeout", description="Timeout a member")
    async def timeout(self, interaction: discord.Interaction, member: discord.Member, minutes: int, reason: str = None):
        if not await self.permission_check(interaction, "moderate_members"):
            return
        if not self.hierarchy_check(interaction, member):
            await interaction.response.send_message("I cannot timeout this member because of role order.", ephemeral=True)
            return

        until = discord.utils.utcnow() + timedelta(minutes=minutes)
        await member.edit(timed_out_until=until, reason=reason)
        await interaction.response.send_message(f"{member} timed out for {minutes} minutes.")
        await self.send_mod_log(
            interaction.guild,
            self.mod_log_embed("Timeout", interaction.user, member, reason, f"{minutes} minutes"),
        )

    @app_commands.command(name="untimeout", description="Remove timeout")
    async def untimeout(self, interaction: discord.Interaction, member: discord.Member, reason: str = None):
        if not await self.permission_check(interaction, "moderate_members"):
            return

        await member.edit(timed_out_until=None, reason=reason)
        await interaction.response.send_message(f"Timeout removed for {member}.")
        await self.send_mod_log(interaction.guild, self.mod_log_embed("Untimeout", interaction.user, member, reason))

    @app_commands.command(name="purge", description="Delete messages")
    async def purge(self, interaction: discord.Interaction, amount: int):
        if not await self.permission_check(interaction, "manage_messages"):
            return
        if amount < 1 or amount > 100:
            await interaction.response.send_message("Amount must be between 1 and 100.", ephemeral=True)
            return

        await interaction.response.defer(ephemeral=True)
        deleted = await interaction.channel.purge(limit=amount)
        await interaction.followup.send(f"Deleted {len(deleted)} messages.", ephemeral=True)
        await self.send_mod_log(
            interaction.guild,
            self.mod_log_embed("Purge", interaction.user, interaction.channel.mention, f"{len(deleted)} messages deleted"),
        )


async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))
