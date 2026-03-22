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
        "strike_mapping": config.get("strike_mapping", {}),
    }


class AutoRole(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot

    @commands.Cog.listener()
    async def on_strike_updated(self, guild, member, count, reason):
        if member.bot: return
        
        config = get_autorole_config()
        mapping = config.get("strike_mapping", {})
        
        if not mapping: return

        # Mapping is like {"1": "role_id_a", "2": "role_id_b", "3": "role_id_c"}
        # We should find the role for the current strike count
        target_role_id = mapping.get(str(count))
        
        # Collect all strike roles to remove others
        all_strike_role_ids = set(mapping.values())
        
        roles_to_remove = []
        for r_id in all_strike_role_ids:
            if str(r_id) == str(target_role_id): continue
            role = guild.get_role(int(r_id))
            if role and role in member.roles:
                roles_to_remove.append(role)
        
        if roles_to_remove:
            await member.remove_roles(*roles_to_remove, reason=f"Strike count updated to {count}")
            
        if target_role_id:
            target_role = guild.get_role(int(target_role_id))
            if target_role and target_role not in member.roles:
                await member.add_roles(target_role, reason=f"Strike count updated to {count}")

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
