import os
from datetime import timedelta

import discord
from discord.ext import commands

from utils.storage import get_log_settings

DEFAULT_EVENT_CHANNEL_ID = int(os.getenv("LOGS_CHANNEL_ID", "0") or 0)
DEFAULT_MODERATION_CHANNEL_ID = int(os.getenv("MODERATION_LOGS_CHANNEL_ID", "0") or 0)


class Logs(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    def resolve_channel_id(self, kind):
        settings = get_log_settings()
        if not settings.get("enabled", True):
            return None

        if kind == "moderation":
            return settings.get("moderation_channel_id") or DEFAULT_MODERATION_CHANNEL_ID
        if kind == "event":
            return settings.get("event_channel_id") or DEFAULT_EVENT_CHANNEL_ID
        return settings.get("system_channel_id") or DEFAULT_EVENT_CHANNEL_ID

    def get_logs_channel(self, guild: discord.Guild, kind):
        channel_id = self.resolve_channel_id(kind)
        if not channel_id:
            return None
        return guild.get_channel(int(channel_id))

    async def send_log(self, guild: discord.Guild, embed: discord.Embed, kind="system"):
        channel = self.get_logs_channel(guild, kind)
        if not channel:
            return
        embed.set_footer(text="IND Blades", icon_url=guild.icon.url if guild.icon else None)
        embed.timestamp = discord.utils.utcnow()
        await channel.send(embed=embed)

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        embed = discord.Embed(
            title="Member Joined",
            description=f"User: {member.mention} ({member.id})",
            color=0x57F287,
        )
        embed.set_thumbnail(url=member.display_avatar.url)
        await self.send_log(member.guild, embed, "system")

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
                title="Moderation Action",
                description=(
                    f"User: {member.mention} ({member.id})\n"
                    f"Action: Kick\n"
                    f"By: {moderator.mention}\n"
                    f"Reason: {reason}"
                ),
                color=0xED4245,
            )
            await self.send_log(guild, embed, "moderation")
            return

        embed = discord.Embed(
            title="Member Left",
            description=f"User: {member.mention} ({member.id})",
            color=0xED4245,
        )
        await self.send_log(guild, embed, "system")

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
            title="Moderation Action",
            description=(
                f"User: {user.mention} ({user.id})\n"
                f"Action: Ban\n"
                f"By: {moderator.mention if moderator else 'Unknown'}\n"
                f"Reason: {reason}"
            ),
            color=0xED4245,
        )
        await self.send_log(guild, embed, "moderation")

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
            title="Moderation Action",
            description=(
                f"User: {user.mention} ({user.id})\n"
                f"Action: Unban\n"
                f"By: {moderator.mention if moderator else 'Unknown'}\n"
                f"Reason: {reason}"
            ),
            color=0x57F287,
        )
        await self.send_log(guild, embed, "moderation")

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
        await self.send_log(message.guild, embed, "moderation")

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
        await self.send_log(before.guild, embed, "moderation")

    @commands.Cog.listener()
    async def on_event_state_change(self, guild, event_data, action: str, moderator):
        if not guild:
            return
        embed = discord.Embed(
            title="Event Updated",
            description=(
                f"Event: {event_data.get('desc')} ({event_data.get('id')})\n"
                f"Action: {action}\n"
                f"By: {moderator.mention if moderator else 'System'}"
            ),
            color=0x5865F2,
        )
        await self.send_log(guild, embed, "event")

    @commands.Cog.listener()
    async def on_event_channel_change(self, guild, event_data, old_channel_id, new_channel_id, moderator):
        if not guild:
            return

        old_channel = guild.get_channel(int(old_channel_id)) if old_channel_id else None
        new_channel = guild.get_channel(int(new_channel_id)) if new_channel_id else None
        embed = discord.Embed(
            title="Event Channel Updated",
            description=(
                f"Event: {event_data.get('desc')} ({event_data.get('id')})\n"
                f"From: {old_channel.mention if old_channel else 'Not set'}\n"
                f"To: {new_channel.mention if new_channel else 'Not set'}\n"
                f"By: {moderator.mention if moderator else 'System'}"
            ),
            color=0x51A7FF,
        )
        await self.send_log(guild, embed, "event")

    @commands.Cog.listener()
    async def on_event_executed(self, guild, event_data, action: str):
        if not guild:
            return
        embed = discord.Embed(
            title="Event Sent",
            description=(
                f"Event: {event_data.get('desc')} ({event_data.get('id')})\n"
                f"Status: {action}"
            ),
            color=0x57F287,
        )
        await self.send_log(guild, embed, "event")


async def setup(bot: commands.Bot):
    await bot.add_cog(Logs(bot))
