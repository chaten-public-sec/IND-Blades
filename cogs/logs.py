import os
from datetime import timedelta

import discord
from discord.ext import commands

from utils.storage import get_discord_logs_v2, get_log_settings
from utils.system_identity import brand_embed

DEFAULT_EVENT_CHANNEL_ID = int(os.getenv("LOGS_CHANNEL_ID", "0") or 0)
DEFAULT_MODERATION_CHANNEL_ID = int(os.getenv("MODERATION_LOGS_CHANNEL_ID", "0") or 0)

LEGACY_LOG_EQUIVALENTS = {
    "member_join": {"join"},
    "member_leave": {"leave"},
    "voice_join": {"join"},
    "voice_leave": {"leave"},
    "voice_move": {"move"},
    "voice_mute": {"mute"},
    "voice_unmute": {"mute"},
    "voice_deafen": {"deafen"},
    "voice_undeafen": {"deafen"},
    "message_delete": {"delete"},
    "message_edit": {"edit"},
    "moderation_kick": {"kick", "moderation"},
    "moderation_ban": {"ban", "moderation"},
    "moderation_unban": {"unban", "moderation"},
    "moderation_timeout": {"timeout", "moderation"},
    "moderation_untimeout": {"untimeout", "moderation"},
    "role_added": {"moderation"},
    "role_removed": {"moderation"},
    "role_updated": {"moderation"},
    "channel_created": {"moderation"},
    "channel_deleted": {"moderation"},
    "channel_updated": {"moderation"},
}


class Logs(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.pin_state = {}

    def category_matches(self, log_key: str, selected_logs):
        selected = {str(item) for item in (selected_logs or [])}
        if log_key in selected:
            return True
        return bool(LEGACY_LOG_EQUIVALENTS.get(log_key, set()) & selected)

    def get_target_channels(self, guild: discord.Guild, log_key: str):
        targets = []
        config = get_discord_logs_v2()
        if config and config.get("enabled"):
            for category in config.get("categories", []):
                if not category.get("enabled") or not category.get("channel_id"):
                    continue
                if not self.category_matches(log_key, category.get("logs")):
                    continue
                channel = guild.get_channel(int(category["channel_id"]))
                if channel:
                    targets.append(channel)

        if not targets and log_key.startswith("moderation_"):
            settings = get_log_settings()
            if settings.get("enabled", True):
                channel_id = settings.get("moderation_channel_id") or DEFAULT_MODERATION_CHANNEL_ID
                if channel_id:
                    channel = guild.get_channel(int(channel_id))
                    if channel:
                        targets.append(channel)

        if not targets and log_key.startswith("channel_"):
            settings = get_log_settings()
            if settings.get("enabled", True):
                channel_id = settings.get("system_channel_id") or DEFAULT_EVENT_CHANNEL_ID
                if channel_id:
                    channel = guild.get_channel(int(channel_id))
                    if channel:
                        targets.append(channel)

        if not targets and log_key == "event_update":
            settings = get_log_settings()
            if settings.get("enabled", True):
                channel_id = settings.get("event_channel_id") or DEFAULT_EVENT_CHANNEL_ID
                if channel_id:
                    channel = guild.get_channel(int(channel_id))
                    if channel:
                        targets.append(channel)

        deduped = []
        seen = set()
        for channel in targets:
            if channel.id in seen:
                continue
            deduped.append(channel)
            seen.add(channel.id)
        return deduped

    async def send_log(self, guild: discord.Guild, embed: discord.Embed, log_key: str):
        channels = self.get_target_channels(guild, log_key)
        if not channels:
            return

        brand_embed(embed, guild, "Telemetry")
        for channel in channels:
            try:
                await channel.send(embed=embed)
            except Exception:
                continue

    async def find_recent_audit_entry(self, guild: discord.Guild, action, target_id: int, seconds: int = 12):
        try:
            async for entry in guild.audit_logs(limit=6, action=action):
                target = getattr(entry, "target", None)
                if not target or getattr(target, "id", None) != target_id:
                    continue
                if (discord.utils.utcnow() - entry.created_at) <= timedelta(seconds=seconds):
                    return entry
        except Exception:
            return None
        return None

    def member_embed(self, title: str, description: str, color: int, member):
        embed = discord.Embed(title=title, description=description, color=color)
        avatar = getattr(member, "display_avatar", None)
        if avatar:
            embed.set_thumbnail(url=avatar.url)
        return embed

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        embed = self.member_embed(
            "Member Joined",
            f"User: {member.mention} (`{member.id}`)",
            0x57F287,
            member,
        )
        await self.send_log(member.guild, embed, "member_join")

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        guild = member.guild
        kick_entry = await self.find_recent_audit_entry(guild, discord.AuditLogAction.kick, member.id)

        if kick_entry:
            reason = kick_entry.reason or "No reason provided"
            embed = self.member_embed(
                "Moderation: Kick",
                f"User: {member.mention} (`{member.id}`)\nBy: {kick_entry.user.mention}\nReason: {reason}",
                0xED4245,
                member,
            )
            await self.send_log(guild, embed, "moderation_kick")
            return

        embed = self.member_embed(
            "Member Left",
            f"User: {member.mention} (`{member.id}`)",
            0xED4245,
            member,
        )
        await self.send_log(guild, embed, "member_leave")

    @commands.Cog.listener()
    async def on_member_ban(self, guild: discord.Guild, user: discord.User):
        entry = await self.find_recent_audit_entry(guild, discord.AuditLogAction.ban, user.id)
        moderator = entry.user.mention if entry and entry.user else "Unknown"
        reason = entry.reason if entry and entry.reason else "No reason provided"
        embed = discord.Embed(
            title="Moderation: Ban",
            description=f"User: {user.mention} (`{user.id}`)\nBy: {moderator}\nReason: {reason}",
            color=0xED4245,
        )
        embed.set_thumbnail(url=user.display_avatar.url)
        await self.send_log(guild, embed, "moderation_ban")

    @commands.Cog.listener()
    async def on_member_unban(self, guild: discord.Guild, user: discord.User):
        entry = await self.find_recent_audit_entry(guild, discord.AuditLogAction.unban, user.id)
        moderator = entry.user.mention if entry and entry.user else "Unknown"
        reason = entry.reason if entry and entry.reason else "No reason provided"
        embed = discord.Embed(
            title="Moderation: Unban",
            description=f"User: {user.mention} (`{user.id}`)\nBy: {moderator}\nReason: {reason}",
            color=0x57F287,
        )
        embed.set_thumbnail(url=user.display_avatar.url)
        await self.send_log(guild, embed, "moderation_unban")

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member):
        if before.roles != after.roles:
            added_roles = list(set(after.roles) - set(before.roles))
            removed_roles = list(set(before.roles) - set(after.roles))

            if added_roles:
                embed = self.member_embed(
                    "Role Added",
                    f"User: {after.mention} (`{after.id}`)\nRoles: {', '.join(role.mention for role in added_roles)}",
                    0x57F287,
                    after,
                )
                await self.send_log(after.guild, embed, "role_added")

            if removed_roles:
                embed = self.member_embed(
                    "Role Removed",
                    f"User: {after.mention} (`{after.id}`)\nRoles: {', '.join(role.mention for role in removed_roles)}",
                    0xED4245,
                    after,
                )
                await self.send_log(after.guild, embed, "role_removed")

        before_timeout = before.timed_out_until
        after_timeout = after.timed_out_until
        if before_timeout != after_timeout:
            active_timeout = after_timeout and after_timeout > discord.utils.utcnow()
            embed = self.member_embed(
                "Moderation: Timeout" if active_timeout else "Moderation: Untimeout",
                (
                    f"User: {after.mention} (`{after.id}`)\n"
                    f"Until: {after_timeout.isoformat() if active_timeout else 'Removed'}"
                ),
                0xFBBF24 if active_timeout else 0x57F287,
                after,
            )
            await self.send_log(after.guild, embed, "moderation_timeout" if active_timeout else "moderation_untimeout")

    @commands.Cog.listener()
    async def on_guild_role_update(self, before: discord.Role, after: discord.Role):
        embed = discord.Embed(
            title="Role Updated",
            description=(
                f"Role: {after.mention}\n"
                f"Before: {before.name}\n"
                f"After: {after.name}"
            ),
            color=0x5865F2,
        )
        await self.send_log(after.guild, embed, "role_updated")

    @commands.Cog.listener()
    async def on_guild_channel_create(self, channel):
        embed = discord.Embed(
            title="Channel Created",
            description=f"Channel: {channel.mention if hasattr(channel, 'mention') else channel.name}\nType: {channel.type}",
            color=0x57F287,
        )
        await self.send_log(channel.guild, embed, "channel_created")

    @commands.Cog.listener()
    async def on_guild_channel_delete(self, channel):
        embed = discord.Embed(
            title="Channel Deleted",
            description=f"Channel: #{channel.name}\nType: {channel.type}",
            color=0xED4245,
        )
        await self.send_log(channel.guild, embed, "channel_deleted")

    @commands.Cog.listener()
    async def on_guild_channel_update(self, before, after):
        changes = []
        if before.name != after.name:
            changes.append(f"Name: `{before.name}` -> `{after.name}`")
        if getattr(before, "category_id", None) != getattr(after, "category_id", None):
            changes.append("Category changed")
        if getattr(before, "position", None) != getattr(after, "position", None):
            changes.append("Position changed")
        if not changes:
            changes.append("Channel settings updated")

        embed = discord.Embed(
            title="Channel Updated",
            description=f"Channel: {after.mention if hasattr(after, 'mention') else after.name}\n" + "\n".join(changes[:5]),
            color=0x5865F2,
        )
        await self.send_log(after.guild, embed, "channel_updated")

    @commands.Cog.listener()
    async def on_message_delete(self, message: discord.Message):
        if not message.guild or message.author.bot:
            return

        content = message.content or "*Empty or attachment only*"
        embed = discord.Embed(
            title="Message Deleted",
            description=(
                f"User: {message.author.mention} (`{message.author.id}`)\n"
                f"Channel: {message.channel.mention}\n"
                f"Content: {content[:1200]}"
            ),
            color=0xED4245,
        )
        embed.set_thumbnail(url=message.author.display_avatar.url)
        await self.send_log(message.guild, embed, "message_delete")

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message):
        if not before.guild or before.author.bot or before.content == after.content:
            return

        embed = discord.Embed(
            title="Message Edited",
            description=(
                f"User: {before.author.mention} (`{before.author.id}`)\n"
                f"Channel: {before.channel.mention}\n"
                f"Before: {(before.content or '*Empty*')[:500]}\n"
                f"After: {(after.content or '*Empty*')[:500]}"
            ),
            color=0xFBBF24,
        )
        embed.set_thumbnail(url=before.author.display_avatar.url)
        await self.send_log(before.guild, embed, "message_edit")

    @commands.Cog.listener()
    async def on_guild_channel_pins_update(self, channel, last_pin):
        guild = getattr(channel, "guild", None)
        if not guild or not isinstance(channel, discord.TextChannel):
            return

        previous = self.pin_state.get(channel.id)
        self.pin_state[channel.id] = last_pin

        if previous == last_pin:
            return

        became_pinned = bool(last_pin and (not previous or last_pin > previous))
        embed = discord.Embed(
            title="Message Pinned" if became_pinned else "Message Unpinned",
            description=f"Channel: {channel.mention}",
            color=0x5865F2 if became_pinned else 0xFBBF24,
        )
        await self.send_log(guild, embed, "message_pin" if became_pinned else "message_unpin")

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        if member.bot:
            return

        guild = member.guild
        old_channel = before.channel
        new_channel = after.channel

        if not old_channel and new_channel:
            embed = self.member_embed(
                "Voice Joined",
                f"{member.mention} joined {new_channel.mention}",
                0x57F287,
                member,
            )
            await self.send_log(guild, embed, "voice_join")
        elif old_channel and not new_channel:
            embed = self.member_embed(
                "Voice Left",
                f"{member.mention} left {old_channel.mention}",
                0xED4245,
                member,
            )
            await self.send_log(guild, embed, "voice_leave")
        elif old_channel and new_channel and old_channel.id != new_channel.id:
            embed = self.member_embed(
                "Voice Moved",
                f"{member.mention} moved from {old_channel.mention} to {new_channel.mention}",
                0x5865F2,
                member,
            )
            await self.send_log(guild, embed, "voice_move")

        if before.self_mute != after.self_mute:
            embed = self.member_embed(
                "Voice Muted" if after.self_mute else "Voice Unmuted",
                f"{member.mention} {'muted' if after.self_mute else 'unmuted'} in {(new_channel or old_channel).mention if (new_channel or old_channel) else 'voice'}",
                0xFBBF24,
                member,
            )
            await self.send_log(guild, embed, "voice_mute" if after.self_mute else "voice_unmute")

        if before.self_deaf != after.self_deaf or before.deaf != after.deaf:
            deafened = after.self_deaf or after.deaf
            embed = self.member_embed(
                "Voice Deafened" if deafened else "Voice Undeafened",
                f"{member.mention} {'deafened' if deafened else 'undeafened'} in {(new_channel or old_channel).mention if (new_channel or old_channel) else 'voice'}",
                0xFBBF24,
                member,
            )
            await self.send_log(guild, embed, "voice_deafen" if deafened else "voice_undeafen")

        if before.self_stream != after.self_stream:
            embed = self.member_embed(
                "Stream Started" if after.self_stream else "Stream Stopped",
                f"{member.mention} {'started' if after.self_stream else 'stopped'} streaming in {(new_channel or old_channel).mention if (new_channel or old_channel) else 'voice'}",
                0x5865F2,
                member,
            )
            await self.send_log(guild, embed, "voice_stream_start" if after.self_stream else "voice_stream_stop")

    @commands.Cog.listener()
    async def on_event_state_change(self, guild, event_data, action: str, moderator):
        if not guild:
            return

        embed = discord.Embed(
            title="Event Updated",
            description=(
                f"Event: {event_data.get('desc')} (`{event_data.get('id')}`)\n"
                f"Action: {action}\n"
                f"By: {moderator.mention if moderator else 'System'}"
            ),
            color=0x5865F2,
        )
        await self.send_log(guild, embed, "event_update")


async def setup(bot: commands.Bot):
    await bot.add_cog(Logs(bot))
