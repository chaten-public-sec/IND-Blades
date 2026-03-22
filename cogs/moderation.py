import os
from datetime import timedelta

import discord
from discord import app_commands
from discord.ext import commands

from utils.storage import get_log_settings

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

    def mod_log_embed(self, action, moderator, target, reason=None, duration=None):
        embed = discord.Embed(title="Moderation Action", color=0xED4245)
        embed.add_field(name="Action", value=action, inline=False)
        embed.add_field(name="Moderator", value=moderator.mention, inline=True)
        embed.add_field(name="Target", value=str(target), inline=True)
        if duration:
            embed.add_field(name="Duration", value=duration, inline=False)
        embed.add_field(name="Reason", value=reason or "No reason provided", inline=False)
        embed.timestamp = discord.utils.utcnow()
        return embed

    async def send_mod_log(self, guild, embed):
        channel = self.resolve_log_channel(guild)
        if channel:
            await channel.send(embed=embed)

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
