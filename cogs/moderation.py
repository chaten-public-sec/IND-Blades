import os
import json
import uuid
from datetime import timedelta

import discord
from discord import app_commands
from discord.ext import commands, tasks

from utils.storage import get_log_settings, load_data, save_data
from utils.system_identity import action_feedback, brand_embed, build_progress_bar

COMMANDS_PATH = os.path.join("data", "commands.json")
SUPPORTED_COMMAND_TYPES = {
    "strike_added",
    "strike_removed",
    "strike_sync",
    "event_created",
    "event_updated",
    "event_deleted",
    "event_paused",
    "event_resumed",
}

DEFAULT_MODERATION_LOGS_CHANNEL_ID = int(os.getenv("MODERATION_LOGS_CHANNEL_ID", "0") or 0)
TARGET_GUILD_ID = int(os.getenv("GUILD_ID", "0") or 0)


def strike_status(strike):
    return str(strike.get("status") or "active")


def active_strike_count(strikes):
    return len([strike for strike in (strikes or []) if strike_status(strike) == "active"])


def strike_color(count):
    if count >= 3:
        return 0xED4245
    if count == 2:
        return 0xF97316
    return 0xFEE75C


class StrikeRecordsView(discord.ui.View):
    def __init__(self, interaction_user_id: int, rows):
        super().__init__(timeout=180)
        self.interaction_user_id = interaction_user_id
        self.rows = rows
        self.page = 0
        self.page_size = 5
        self.sync_buttons()

    def total_pages(self):
        return max(1, (len(self.rows) + self.page_size - 1) // self.page_size)

    def sync_buttons(self):
        self.prev_page.disabled = self.page <= 0
        self.next_page.disabled = self.page >= self.total_pages() - 1

    def build_embed(self):
        embed = discord.Embed(
            title="⚠️ Strike Records",
            color=0xFEE75C,
        )

        if not self.rows:
            embed.description = "No strike records found."
        else:
            start = self.page * self.page_size
            items = self.rows[start : start + self.page_size]
            lines = []
            for row in items:
                lines.append(
                    f"👤 **{row['name']}**\n"
                    f"Strikes: {row['active_count']}\n"
                    f"Last Strike: {row['last_strike']}"
                )
            embed.description = "\n\n".join(lines)

        embed.set_footer(text=f"IND Blades • Strike System • Page {self.page + 1}/{self.total_pages()}")
        embed.timestamp = discord.utils.utcnow()
        return embed

    async def interaction_check(self, interaction: discord.Interaction):
        if interaction.user.id != self.interaction_user_id:
            await interaction.response.send_message("Only the original command user can control this view.", ephemeral=True)
            return False
        return True

    @discord.ui.button(label="⬅️ Previous", style=discord.ButtonStyle.secondary)
    async def prev_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.page = max(0, self.page - 1)
        self.sync_buttons()
        await interaction.response.edit_message(embed=self.build_embed(), view=self)

    @discord.ui.button(label="➡️ Next", style=discord.ButtonStyle.secondary)
    async def next_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.page = min(self.total_pages() - 1, self.page + 1)
        self.sync_buttons()
        await interaction.response.edit_message(embed=self.build_embed(), view=self)


class StrikeUserDetailsView(discord.ui.View):
    def __init__(self, interaction_user_id: int, member: discord.Member, strikes, name_lookup):
        super().__init__(timeout=180)
        self.interaction_user_id = interaction_user_id
        self.member = member
        self.strikes = strikes
        self.name_lookup = name_lookup
        self.page = 0
        self.page_size = 4
        self.sync_buttons()

    def total_pages(self):
        return max(1, (len(self.strikes) + self.page_size - 1) // self.page_size)

    def sync_buttons(self):
        self.prev_page.disabled = self.page <= 0
        self.next_page.disabled = self.page >= self.total_pages() - 1

    def build_embed(self):
        active_count = active_strike_count(self.strikes)
        embed = discord.Embed(
            title=f"⚠️ Strike Details - {self.member.display_name}",
            color=strike_color(active_count if active_count else 1),
        )
        embed.add_field(name="Username", value=self.member.mention, inline=True)
        embed.add_field(name="Active Strikes", value=str(active_count), inline=True)
        embed.set_thumbnail(url=self.member.display_avatar.url)

        if not self.strikes:
            embed.description = "This user has no strikes."
        else:
            start = self.page * self.page_size
            items = self.strikes[start : start + self.page_size]
            description_lines = []
            for index, strike in enumerate(items, start=start + 1):
                issued_by = self.name_lookup.get(str(strike.get("issued_by"))) or str(strike.get("issued_by") or "System")
                revoked_by = self.name_lookup.get(str(strike.get("revoked_by"))) or str(strike.get("revoked_by") or "N/A")
                description_lines.append(
                    f"🟥 **Strike {index}**\n"
                    f"Reason: {strike.get('reason') or 'No reason provided'}\n"
                    f"Given by: {issued_by}\n"
                    f"Date: {strike.get('timestamp') or 'Unknown'}\n"
                    f"Expires: {strike.get('expires_at') or 'Unknown'}\n"
                    f"Status: {strike_status(strike)}\n"
                    f"Revoked by: {revoked_by}"
                )
            embed.description = "\n\n".join(description_lines)

        embed.set_footer(text=f"IND Blades • Strike System • Page {self.page + 1}/{self.total_pages()}")
        embed.timestamp = discord.utils.utcnow()
        return embed

    async def interaction_check(self, interaction: discord.Interaction):
        if interaction.user.id != self.interaction_user_id:
            await interaction.response.send_message("Only the original command user can control this view.", ephemeral=True)
            return False
        return True

    @discord.ui.button(label="⬅️ Previous", style=discord.ButtonStyle.secondary)
    async def prev_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.page = max(0, self.page - 1)
        self.sync_buttons()
        await interaction.response.edit_message(embed=self.build_embed(), view=self)

    @discord.ui.button(label="➡️ Next", style=discord.ButtonStyle.secondary)
    async def next_page(self, interaction: discord.Interaction, button: discord.ui.Button):
        self.page = min(self.total_pages() - 1, self.page + 1)
        self.sync_buttons()
        await interaction.response.edit_message(embed=self.build_embed(), view=self)


class Moderation(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    def resolve_guild(self):
        if TARGET_GUILD_ID:
            guild = self.bot.get_guild(TARGET_GUILD_ID)
            if guild:
                return guild
        return self.bot.guilds[0] if self.bot.guilds else None

    def resolve_log_channel(self, guild: discord.Guild):
        settings = get_log_settings()
        channel_id = settings.get("moderation_channel_id") or DEFAULT_MODERATION_LOGS_CHANNEL_ID
        if not channel_id or not settings.get("enabled", True):
            return None
        return guild.get_channel(int(channel_id))

    def mod_log_embed(self, action, moderator, target, reason=None, duration=None, strikes=None):
        embed = discord.Embed(title=action_feedback("danger"), color=0xED4245)
        embed.add_field(name="Action", value=action, inline=False)
        embed.add_field(name="Moderator", value=moderator.mention if hasattr(moderator, 'mention') else str(moderator), inline=True)
        embed.add_field(name="Target", value=target.mention if hasattr(target, 'mention') else str(target), inline=True)
        if duration:
            embed.add_field(name="Duration", value=duration, inline=False)
        if strikes is not None:
            embed.add_field(name="Strikes", value=str(strikes), inline=True)
            embed.add_field(name="System State", value=f"{build_progress_bar(min(int(strikes or 0), 6), 6)} synced", inline=True)
        embed.add_field(name="Reason", value=reason or "No reason provided", inline=False)
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
            brand_embed(embed, guild, "Moderation")
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

    def parse_iso(self, value):
        if not value:
            return None
        try:
            return discord.utils.parse_time(value)
        except Exception:
            return None

    def mark_command_done(self, cmd, note=None):
        cmd["status"] = "done"
        cmd.pop("error", None)
        cmd.pop("retry_at", None)
        cmd.pop("processing_started_at", None)
        if note:
            cmd["note"] = note
        else:
            cmd.pop("note", None)
        cmd["completed_at"] = discord.utils.utcnow().isoformat()

    def mark_command_failed(self, cmd, error):
        attempts = int(cmd.get("attempts", 0) or 0)
        max_attempts = int(cmd.get("max_attempts", 5) or 5)
        retry_delay_seconds = min(60, max(5, attempts * 5))

        cmd["status"] = "failed"
        cmd["error"] = str(error)
        cmd["completed_at"] = discord.utils.utcnow().isoformat()
        cmd.pop("processing_started_at", None)

        if attempts < max_attempts:
            cmd["retry_at"] = (discord.utils.utcnow() + timedelta(seconds=retry_delay_seconds)).isoformat()
        else:
            cmd.pop("retry_at", None)

    @tasks.loop(seconds=5)
    async def global_command_worker(self):
        """Process strike and event commands from dashboard API."""
        guild = self.resolve_guild()
        if not guild:
            return
        commands_list = self.load_commands()
        updated = False
        now = discord.utils.utcnow()
        
        # Recover stale or retryable commands before claiming new work.
        for cmd in commands_list:
            if cmd.get("type") not in SUPPORTED_COMMAND_TYPES:
                continue

            status = cmd.get("status")
            attempts = int(cmd.get("attempts", 0) or 0)
            max_attempts = int(cmd.get("max_attempts", 5) or 5)

            if status == "processing":
                started_at = self.parse_iso(cmd.get("processing_started_at"))
                if not started_at or (now - started_at).total_seconds() >= 90:
                    cmd["status"] = "pending"
                    cmd.pop("processing_started_at", None)
                    updated = True
                    status = "pending"

            if status == "failed" and attempts < max_attempts:
                retry_at = self.parse_iso(cmd.get("retry_at"))
                if not retry_at or retry_at <= now:
                    cmd["status"] = "pending"
                    cmd.pop("retry_at", None)
                    updated = True
                    status = "pending"

            if status == "pending":
                available_at = self.parse_iso(cmd.get("available_at"))
                if available_at and available_at > now:
                    continue
                cmd["status"] = "processing"
                cmd["attempts"] = attempts + 1
                cmd["processing_started_at"] = now.isoformat()
                updated = True
        
        if updated:
            self.save_commands(commands_list)
        
        # Process processing commands
        for cmd in commands_list:
            if cmd.get("type") not in SUPPORTED_COMMAND_TYPES:
                continue
            if cmd.get("status") != "processing":
                continue
            
            cmd_type = cmd.get("type")
            payload = cmd.get("payload", {})
            
            try:
                if cmd_type in ("strike_added", "strike_removed", "strike_sync"):
                    user_id = payload.get("user_id")
                    if not user_id:
                        raise RuntimeError("Strike command is missing user_id")

                    strike_count = payload.get("strike_count", 0)
                    member = guild.get_member(int(user_id))
                    if not member:
                        try:
                            member = await guild.fetch_member(int(user_id))
                        except discord.NotFound:
                            member = None
                    if not member:
                        self.mark_command_done(cmd, "member_not_found")
                        self.save_commands(commands_list)
                        continue

                    action_type = payload.get("action")
                    if cmd_type == "strike_added":
                        action_type = "added"
                    elif cmd_type == "strike_removed":
                        action_type = "removed"
                    else:
                        action_type = str(action_type or "sync")

                    self.bot.dispatch(
                        "strike_updated",
                        guild,
                        member,
                        strike_count,
                        action_type,
                        payload,
                    )
                
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
                    
            except Exception as error:
                print(f"[ERROR] Command worker failed for {cmd_type}: {error}")
                self.mark_command_failed(cmd, error)
                self.save_commands(commands_list)
                continue

            self.mark_command_done(cmd)
            self.save_commands(commands_list)

    @global_command_worker.before_loop
    async def before_worker(self):
        await self.bot.wait_until_ready()

    @tasks.loop(hours=1)
    async def strike_expiry_check(self):
        data = load_data()
        if "__strikes__" not in data:
            return
        guild = self.resolve_guild()
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
                        self.bot.dispatch("strike_updated", guild, member, user_data["strike_count"], "expired", {})
                except Exception:
                    pass
        if changed:
            save_data(data)

    async def cog_load(self):
        self.global_command_worker.start()

    async def cog_unload(self):
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
        app_commands.Choice(name="View Records", value="view"),
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

        if action == "view":
            if user is None:
                strike_rows = []
                name_lookup = {}
                for member in interaction.guild.members:
                    name_lookup[str(member.id)] = member.display_name

                for user_id, user_data in data.get("__strikes__", {}).items():
                    strikes = list(user_data.get("strikes", []))
                    if not strikes:
                        continue
                    member = interaction.guild.get_member(int(user_id))
                    display_name = member.display_name if member else f"User {str(user_id)[-4:]}"
                    last_strike = sorted(
                        [strike.get("timestamp") or strike.get("expires_at") for strike in strikes if strike.get("timestamp") or strike.get("expires_at")],
                        reverse=True,
                    )
                    strike_rows.append({
                        "user_id": str(user_id),
                        "name": display_name,
                        "active_count": active_strike_count(strikes),
                        "last_strike": last_strike[0] if last_strike else "Unknown",
                    })

                strike_rows.sort(key=lambda item: (-item["active_count"], item["name"].lower()))
                view = StrikeRecordsView(interaction.user.id, strike_rows)
                await interaction.response.send_message(embed=view.build_embed(), view=view)
                return

            user_id = str(user.id)
            strike_bucket = data.get("__strikes__", {}).get(user_id, {"strikes": []})
            strikes = sorted(
                list(strike_bucket.get("strikes", [])),
                key=lambda strike: str(strike.get("timestamp") or ""),
                reverse=True,
            )
            name_lookup = {str(member.id): member.display_name for member in interaction.guild.members}
            view = StrikeUserDetailsView(interaction.user.id, user, strikes, name_lookup)
            await interaction.response.send_message(embed=view.build_embed(), view=view)
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
            
            timestamp = discord.utils.utcnow().isoformat()
            strike_entry = {
                "id": str(uuid.uuid4()),
                "reason": reason,
                "timestamp": timestamp,
                "violation_time": timestamp,
                "expires_at": (discord.utils.utcnow() + timedelta(days=expiry)).isoformat(),
                "issued_by": str(interaction.user.id),
                "issued_by_role": None,
                "proof_links": [],
                "witness_text": "",
                "request_id": None,
                "status": "active",
                "revoked_at": None,
                "revoked_by": None,
                "revoked_reason": "",
                "expired_at": None,
                "metadata": {}
            }
            data["__strikes__"][user_id]["strikes"].append(strike_entry)
            data["__strikes__"][user_id]["strike_count"] = len([s for s in data["__strikes__"][user_id]["strikes"] if s.get("status", "active") == "active"])
            count = data["__strikes__"][user_id]["strike_count"]
            save_data(data)
            
            embed = self.strike_embed(user, reason, count)
            await interaction.response.send_message(embed=embed)
            await self.send_mod_log(interaction.guild, self.mod_log_embed("Strike Added", interaction.user, user, reason, strikes=count))
            self.bot.dispatch(
                "strike_updated",
                interaction.guild,
                user,
                count,
                "added",
                {
                    "user_id": str(user.id),
                    "reason": reason,
                    "strike_count": count,
                    "issued_by": str(interaction.user.id),
                    "issued_by_name": interaction.user.display_name,
                    "issued_by_role": None,
                    "expires_at": strike_entry["expires_at"],
                    "violation_time": strike_entry["timestamp"],
                    "proof_links": [],
                    "witness_text": "",
                },
            )

        elif action == "remove":
            user_id = str(user.id)
            if "__strikes__" not in data or user_id not in data["__strikes__"] or not data["__strikes__"][user_id]["strikes"]:
                await interaction.response.send_message("This user has no strikes.", ephemeral=True)
                return

            active_indexes = [
                index for index, strike in enumerate(data["__strikes__"][user_id]["strikes"])
                if strike.get("status", "active") == "active"
            ]
            if not active_indexes:
                await interaction.response.send_message("This user has no active strikes.", ephemeral=True)
                return

            removed_index = active_indexes[-1]
            removed = data["__strikes__"][user_id]["strikes"][removed_index]
            data["__strikes__"][user_id]["strikes"][removed_index] = {
                **removed,
                "status": "revoked",
                "revoked_at": discord.utils.utcnow().isoformat(),
                "revoked_by": str(interaction.user.id),
                "revoked_reason": f"Removed: {removed['reason']}",
            }
            data["__strikes__"][user_id]["strike_count"] = len([
                strike for strike in data["__strikes__"][user_id]["strikes"]
                if strike.get("status", "active") == "active"
            ])
            count = data["__strikes__"][user_id]["strike_count"]
            save_data(data)

            embed = discord.Embed(
                title="✅ Strike Revoked",
                color=0x57F287,
                description=(
                    f"Target: {user.mention}\n"
                    f"Revoked by: {interaction.user.mention}\n"
                    f"Remaining Active Strikes: {count}"
                ),
            )
            embed.add_field(name="Revoked Strike", value=removed.get("reason") or "No reason provided", inline=False)
            embed.add_field(name="Original Date", value=str(removed.get("timestamp") or "Unknown"), inline=True)
            embed.add_field(name="Expires", value=str(removed.get("expires_at") or "Unknown"), inline=True)
            embed.add_field(name="Status", value="revoked", inline=True)
            embed.add_field(name="Revoked Reason", value=f"Removed: {removed['reason']}", inline=False)
            embed.set_thumbnail(url=user.display_avatar.url)
            embed.set_footer(text="IND Blades • Strike System")
            embed.timestamp = discord.utils.utcnow()

            await interaction.response.send_message(embed=embed)
            await self.send_mod_log(interaction.guild, self.mod_log_embed("Strike Removed", interaction.user, user, f"Removed: {removed['reason']}", strikes=count))
            self.bot.dispatch(
                "strike_updated",
                interaction.guild,
                user,
                count,
                "removed",
                {
                    "user_id": str(user.id),
                    "strike_count": count,
                    "removed_by": str(interaction.user.id),
                    "removed_by_name": interaction.user.display_name,
                    "reason": f"Removed: {removed['reason']}",
                },
            )

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
        await interaction.response.send_message(f"Override complete. {member.mention} has been removed.")
        await self.send_mod_log(interaction.guild, self.mod_log_embed("Kick", interaction.user, member, reason))

    @app_commands.command(name="ban", description="Ban a member")
    async def ban(self, interaction: discord.Interaction, member: discord.Member, reason: str = None):
        if not await self.permission_check(interaction, "ban_members"):
            return
        if not self.hierarchy_check(interaction, member):
            await interaction.response.send_message("I cannot ban this member because of role order.", ephemeral=True)
            return

        await member.ban(reason=reason)
        await interaction.response.send_message(f"System override applied. {member.mention} has been banned.")
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

        await interaction.response.send_message(f"Access restored. {user_obj.mention} has been unbanned.")
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
        await interaction.response.send_message(f"Node locked. {member.mention} timed out for {minutes} minute(s).")
        await self.send_mod_log(
            interaction.guild,
            self.mod_log_embed("Timeout", interaction.user, member, reason, f"{minutes} minutes"),
        )

    @app_commands.command(name="untimeout", description="Remove timeout")
    async def untimeout(self, interaction: discord.Interaction, member: discord.Member, reason: str = None):
        if not await self.permission_check(interaction, "moderate_members"):
            return

        await member.edit(timed_out_until=None, reason=reason)
        await interaction.response.send_message(f"Control signal updated. Timeout removed for {member.mention}.")
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
        await interaction.followup.send(f"Override complete. Cleared {len(deleted)} message(s).", ephemeral=True)
        await self.send_mod_log(
            interaction.guild,
            self.mod_log_embed("Purge", interaction.user, interaction.channel.mention, f"{len(deleted)} messages deleted"),
        )


async def setup(bot: commands.Bot):
    await bot.add_cog(Moderation(bot))
