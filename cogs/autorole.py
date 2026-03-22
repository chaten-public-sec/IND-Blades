import os
import json

import discord
from discord.ext import commands

from utils.storage import load_data

DATA_PATH = os.path.join("data", "reminders.json")


def get_autorole_config():
    data = load_data()
    config = data.get("__autorole__", {})
    return {
        "join_role_id": config.get("join_role_id"),
        "bindings": config.get("bindings", []),
    }


class AutoRole(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        if member.bot:
            return

        config = get_autorole_config()
        join_role_id = config.get("join_role_id")

        if not join_role_id:
            return

        try:
            role = member.guild.get_role(int(join_role_id))
            if role and role not in member.roles:
                await member.add_roles(role, reason="Auto Role: join role assignment")
        except Exception as error:
            print(f"[AutoRole] Failed to assign join role: {error}")

    @commands.Cog.listener()
    async def on_member_update(self, before: discord.Member, after: discord.Member):
        if after.bot:
            return

        if set(before.roles) == set(after.roles):
            return

        config = get_autorole_config()
        bindings = config.get("bindings", [])

        if not bindings:
            return

        added_roles = set(after.roles) - set(before.roles)

        for binding in bindings:
            role_a_id = binding.get("role_a")
            role_b_id = binding.get("role_b")

            if not role_a_id or not role_b_id:
                continue

            for added_role in added_roles:
                if str(added_role.id) == str(role_a_id):
                    try:
                        target_role = after.guild.get_role(int(role_b_id))
                        if target_role and target_role not in after.roles:
                            await after.add_roles(
                                target_role,
                                reason=f"Auto Role: binding {added_role.name} -> {target_role.name}",
                            )
                    except Exception as error:
                        print(f"[AutoRole] Binding error: {error}")


async def setup(bot: commands.Bot):
    await bot.add_cog(AutoRole(bot))
