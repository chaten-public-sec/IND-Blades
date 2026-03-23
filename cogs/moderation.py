import os
import json
from datetime import timedelta

import discord
from discord import app_commands
from discord.ext import commands, tasks

from utils.storage import get_log_settings, load_data, save_data

COMMANDS_PATH = os.path.join("data", "commands.json")

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

    # Auto-strike on event absence REMOVED per requirement: Admin manually assigns strike only

    def load_commands(self):
        if not os.path.exists(COMMANDS_PATH):
            return []
        try:
            with open(COMMANDS_PATH, "r", encoding="utf-8") as f:
                v = json.load(f)
                return v if isinstance(v, list) else []
        except Exception:
            return []

    def save_commands(self, commands_list):
        os.makedirs("data", exist_ok=True)
        with open(COMMANDS_PATH, "w", encoding="utf-8") as f:
            json.dump(commands_list, f, indent=2)

    @tasks.loop(seconds=5)
    async def global_command_worker(self):
        """Process strike and event commands from dashboard API."""
        guild = self.bot.guilds[0] if self.bot.guilds else None
        if not guild:
            return
        commands_list = self.load_commands()
        updated = False
        
        # Mark pending commands as processing
        for cmd in commands_list:
            if cmd.get("status") == "pending":
                cmd["status"] = "processing"
                updated = True
        
        if updated:
            self.save_commands(commands_list)
        
        # Process processing commands
        for cmd in commands_list:
            if cmd.get("status") != "processing":
                continue
            
            cmd_type = cmd.get("type")
            payload = cmd.get("payload", {})
            
            try:
                if cmd_type in ("strike_added", "strike_removed"):
                    user_id = payload.get("user_id")
                    strike_count = payload.get("strike_count", 0)
                    member = guild.get_member(int(user_id))
                    if not member:
                        member = await guild.fetch_member(int(user_id))
                    if member:
                        self.bot.dispatch("strike_updated", guild, member, strike_count, "added" if cmd_type == "strike_added" else "removed")
                
                elif cmd_type in ("event_created", "event_updated", "event_deleted", "event_paused", "event_resumed"):
                    event_data = payload.get("event", {})
                    if cmd_type == "event_deleted":
                        event_data = {"desc": payload.get("name", "Untitled"), "id": payload.get("id")}
                    
                    action_map = {
                        "event_created": "Event created",
                        "event_updated": "Event updated",
                        "event_deleted": "Event deleted",
                        "event_paused": "Event disabled",
                        "event_resumed": "Event enabled"
                    }
                    
                    # Notify system
                    self.bot.dispatch("event_state_change", guild, event_data, action_map.get(cmd_type, "Action performed"), None)
                    
            except Exception as e:
                print(f"[ERROR] Command worker failed for {cmd_type}: {e}")
            
            cmd["status"] = "done"
            cmd["completed_at"] = discord.utils.utcnow().isoformat()
            self.save_commands(commands_list)

    @global_command_worker.before_loop
    async def before_worker(self):
        await self.bot.wait_until_ready()

    @tasks.loop(hours=1)
    async def strike_expiry_check(self):
        data = load_data()
        if "__strikes__" not in data:
            return
        guild = self.bot.guilds[0] if self.bot.guilds else None
        if not guild:
            return
        changed = False
        now = discord.utils.utcnow()
        for user_id, user_data in data["__strikes__"].items():
            original_count = len(user_data["strikes"])
            try:
                user_data["strikes"] = [s for s in user_data["strikes"] if discord.utils.parse_time(s["expires_at"]) > now]
            except Exception:
                continue
            if len(user_data["strikes"]) != original_count:
                user_data["strike_count"] = len(user_data["strikes"])
                changed = True
                try:
                    member = guild.get_member(int(user_id))
                    if not member:
                        member = await guild.fetch_member(int(user_id))
                    if member:
                        self.bot.dispatch("strike_updated", guild, member, user_data["strike_count"], "expired")
                except Exception:
                    pass
        if changed:
            save_data(data)

    async def cog_load(self):
        self.strike_expiry_check.start()
        self.global_command_worker.start()

    async def cog_unload(self):
        self.strike_expiry_check.cancel()
        self.global_command_worker.cancel()

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
