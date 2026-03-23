import os
from datetime import timedelta

import discord
from discord.ext import commands

from utils.storage import get_log_settings, get_discord_logs_v2

DEFAULT_EVENT_CHANNEL_ID = int(os.getenv("LOGS_CHANNEL_ID", "0") or 0)
DEFAULT_MODERATION_CHANNEL_ID = int(os.getenv("MODERATION_LOGS_CHANNEL_ID", "0") or 0)


class Logs(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    def get_target_channels(self, guild: discord.Guild, log_type: str):
        """Find all enabled channels for a specific log type."""
        targets = []
        dl = get_discord_logs_v2()
        if dl and dl.get("enabled"):
            for cat in dl.get("categories", []):
                if cat.get("enabled") and log_type in cat.get("logs", []) and cat.get("channel_id"):
                    try:
                        ch = guild.get_channel(int(cat["channel_id"]))
                        if ch:
                            targets.append(ch)
                    except:
                        pass
        
        # Legacy fallback for basic moderation if no v2 categories match
        if not targets and log_type in ("ban", "unban", "kick", "timeout", "join"):
            settings = get_log_settings()
            if settings.get("enabled", True):
                ch_id = settings.get("moderation_channel_id") or DEFAULT_MODERATION_CHANNEL_ID
                if ch_id:
                    ch = guild.get_channel(int(ch_id))
                    if ch:
                        targets.append(ch)
                    
        return targets

    async def send_log(self, guild: discord.Guild, embed: discord.Embed, log_type: str):
        channels = self.get_target_channels(guild, log_type)
        if not channels:
            return
            
        embed.set_footer(text="IND Blades", icon_url=guild.icon.url if guild.icon else None)
        embed.timestamp = discord.utils.utcnow()
        
        for ch in channels:
            try:
                await ch.send(embed=embed)
            except:
                pass

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        embed = discord.Embed(
            title="Member Joined",
            description=f"User: {member.mention} ({member.id})",
            color=0x57F287,
        )
        embed.set_thumbnail(url=member.display_avatar.url)
        await self.send_log(member.guild, embed, "join")

    @commands.Cog.listener()
    async def on_member_remove(self, member: discord.Member):
        guild = member.guild
        moderator = None
        reason = "No reason provided"

        async for entry in guild.audit_logs(limit=5, action=discord.AuditLogAction.kick):
            if entry.target.id == member.id and (discord.utils.utcnow() - entry.created_at) <= timedelta(seconds=10):
                moderator = entry.user
                reason = entry.reason or reason
                break

        if moderator:
            embed = discord.Embed(
                title="Moderation Action: Kick",
                description=(
                    f"User: {member.mention} ({member.id})\n"
                    f"By: {moderator.mention}\n"
                    f"Reason: {reason}"
                ),
                color=0xED4245,
            )
            await self.send_log(guild, embed, "kick")
        else:
            embed = discord.Embed(
                title="Member Left",
                description=f"User: {member.mention} ({member.id})",
                color=0xED4245,
            )
            await self.send_log(guild, embed, "leave")

    @commands.Cog.listener()
    async def on_member_ban(self, guild: discord.Guild, user: discord.User):
        moderator = None
        reason = "No reason provided"
        async for entry in guild.audit_logs(limit=5, action=discord.AuditLogAction.ban):
            if entry.target.id == user.id:
                moderator = entry.user
                reason = entry.reason or reason
                break
        embed = discord.Embed(
            title="Moderation Action: Ban",
            description=(
                f"User: {user.mention} ({user.id})\n"
                f"By: {moderator.mention if moderator else 'Unknown'}\n"
                f"Reason: {reason}"
            ),
            color=0xED4245,
        )
        await self.send_log(guild, embed, "ban")

    @commands.Cog.listener()
    async def on_member_unban(self, guild: discord.Guild, user: discord.User):
        moderator = None
        reason = "No reason provided"
        async for entry in guild.audit_logs(limit=5, action=discord.AuditLogAction.unban):
            if entry.target.id == user.id:
                moderator = entry.user
                reason = entry.reason or reason
                break
        embed = discord.Embed(
            title="Moderation Action: Unban",
            description=(
                f"User: {user.mention} ({user.id})\n"
                f"By: {moderator.mention if moderator else 'Unknown'}\n"
                f"Reason: {reason}"
            ),
            color=0x57F287,
        )
        await self.send_log(guild, embed, "unban")

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member):
        if before.roles == after.roles:
            return
        
        added = ", ".join(role.mention for role in (set(after.roles) - set(before.roles))) or "None"
        removed = ", ".join(role.mention for role in (set(before.roles) - set(after.roles))) or "None"
        embed = discord.Embed(
            title="Role Update",
            description=(
                f"User: {after.mention} ({after.id})\n"
                f"Added: {added}\n"
                f"Removed: {removed}"
            ),
            color=0x5865F2,
        )
        # Role updates fall under general moderation log type for now
        await self.send_log(after.guild, embed, "moderation")

    @commands.Cog.listener()
    async def on_message_delete(self, message: discord.Message):
        if not message.guild or message.author.bot:
            return
        
        embed = discord.Embed(
            title="Message Deleted",
            description=(
                f"User: {message.author.mention} ({message.author.id})\n"
                f"Channel: {message.channel.mention}\n"
                f"Content: {message.content or '*Empty or attachment only*'}"
            ),
            color=0xED4245,
        )
        await self.send_log(message.guild, embed, "delete")

    @commands.Cog.listener()
    async def on_message_edit(self, before: discord.Message, after: discord.Message):
        if not before.guild or before.author.bot or before.content == after.content:
            return
        
        embed = discord.Embed(
            title="Message Edited",
            description=(
                f"User: {before.author.mention} ({before.author.id})\n"
                f"Channel: {before.channel.mention}\n"
                f"Before: {before.content or '*Empty*'}\n"
                f"After: {after.content or '*Empty*'}"
            ),
            color=0xFBBF24,
        )
        await self.send_log(before.guild, embed, "edit")

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        if member.bot:
            return
            
        guild = member.guild
        old_ch = before.channel
        new_ch = after.channel

        if not old_ch and new_ch:
            embed = discord.Embed(
                title="Voice: Join",
                description=f"{member.mention} joined {new_ch.mention}",
                color=0x57F287,
            )
            await self.send_log(guild, embed, "join")
        elif old_ch and not new_ch:
            embed = discord.Embed(
                title="Voice: Leave",
                description=f"{member.mention} left {old_ch.mention}",
                color=0xED4245,
            )
            await self.send_log(guild, embed, "leave")
        elif old_ch and new_ch and old_ch.id != new_ch.id:
            embed = discord.Embed(
                title="Voice: Move",
                description=f"{member.mention} moved from {old_ch.mention} to {new_ch.mention}",
                color=0x5865F2,
            )
            await self.send_log(guild, embed, "move")
        elif before.self_mute != after.self_mute or before.self_deaf != after.self_deaf:
            actions = []
            log_type = "mute"
            if before.self_mute != after.self_mute:
                actions.append("muted" if after.self_mute else "unmuted")
            if before.self_deaf != after.self_deaf:
                actions.append("deafened" if after.self_deaf else "undeafened")
                log_type = "deafen"
            
            ch = new_ch or old_ch
            ch_mention = ch.mention if ch else "a channel"
            embed = discord.Embed(
                title="Voice Activity",
                description=f"{member.mention} {' '.join(actions)} in {ch_mention}",
                color=0xFBBF24,
            )
            embed.set_thumbnail(url=member.display_avatar.url)
            await self.send_log(guild, embed, log_type)

    @commands.Cog.listener()
    async def on_event_state_change(self, guild, event_data, action: str, moderator):
        if not guild: return
        embed = discord.Embed(
            title="Event Updated",
            description=(
                f"Event: {event_data.get('desc')} ({event_data.get('id')})\n"
                f"Action: {action}\n"
                f"By: {moderator.mention if moderator else 'System'}"
            ),
            color=0x5865F2,
        )
        # Global moderation for events
        await self.send_log(guild, embed, "moderation")


async def setup(bot: commands.Bot):
    await bot.add_cog(Logs(bot))
