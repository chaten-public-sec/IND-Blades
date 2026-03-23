import asyncio
import json
import os

import discord
from discord import app_commands
from discord.ext import commands, tasks

from utils.storage import load_data, save_data

WELCOME_CHANNEL_ID = int(os.getenv("WELCOME_CHANNEL_ID", "0") or 0)
MEMBER_ROLE_ID = int(os.getenv("MEMBER_ROLE_ID", "0") or 0)
GIF_PATH = "assets/ind-blades.gif"
COMMANDS_PATH = "data/commands.json"


def get_welcome_config():
    data = load_data()
    return data.get("__welcome__", {"enabled": True, "channel_id": WELCOME_CHANNEL_ID})


def save_welcome_config(config):
    data = load_data()
    data["__welcome__"] = config
    save_data(data)


def load_commands():
    if not os.path.exists(COMMANDS_PATH):
        return []
    try:
        with open(COMMANDS_PATH, "r", encoding="utf-8") as file_handle:
            value = json.load(file_handle)
            return value if isinstance(value, list) else []
    except Exception:
        return []


def save_commands(commands_list):
    os.makedirs("data", exist_ok=True)
    with open(COMMANDS_PATH, "w", encoding="utf-8") as file_handle:
        json.dump(commands_list, file_handle, indent=2)


def generate_welcome_embed(member: discord.Member):
    member_count = member.guild.member_count if member.guild else "Unknown"
    embed = discord.Embed(
        title="",
        description=(
            f"✨ Welcome {member.mention} to the IND Blades Family! ✨\n\n"
            "We're thrilled to have you here. Please verify yourself, grab your roles, and dive into the voice chats!\n\n"
            "Let's make some amazing memories! ⚡\n\n"
            f"**Member #{member_count}** • IND Blades • Premium Entry"
        ),
        color=0x51A7FF,
    )
    if member.avatar:
        embed.set_thumbnail(url=member.avatar.url)
    embed.set_footer(text="IND Blades", icon_url=member.guild.icon.url if member.guild.icon else None)
    embed.timestamp = discord.utils.utcnow()
    return embed


class WelcomeChannelDropdown(discord.ui.ChannelSelect):
    def __init__(self):
        super().__init__(
            placeholder="Select a welcome channel",
            min_values=1,
            max_values=1,
            channel_types=[discord.ChannelType.text],
        )

    async def callback(self, interaction: discord.Interaction):
        config = get_welcome_config()
        config["channel_id"] = self.values[0].id
        save_welcome_config(config)

        for child in self.view.children:
            child.disabled = True

        await interaction.response.edit_message(content="Saved successfully.", view=self.view)
        self.view.stop()


class WelcomeChannelView(discord.ui.View):
    def __init__(self):
        super().__init__(timeout=60)
        self.add_item(WelcomeChannelDropdown())


class WelcomePanel(discord.ui.View):
    def __init__(self, cog, interaction: discord.Interaction):
        super().__init__(timeout=300)
        self.cog = cog
        self.interaction = interaction
        self.refresh_items()

    def refresh_items(self):
        self.clear_items()
        config = get_welcome_config()
        enabled = config.get("enabled", True)

        turn_on = discord.ui.Button(
            label="Turn On",
            style=discord.ButtonStyle.success,
            disabled=enabled,
        )
        turn_off = discord.ui.Button(
            label="Turn Off",
            style=discord.ButtonStyle.danger,
            disabled=not enabled,
        )
        choose_channel = discord.ui.Button(
            label="Change Channel",
            style=discord.ButtonStyle.secondary,
        )
        preview = discord.ui.Button(
            label="Preview Welcome",
            style=discord.ButtonStyle.secondary,
        )
        close = discord.ui.Button(
            label="Close",
            style=discord.ButtonStyle.secondary,
        )

        turn_on.callback = self.turn_on_callback
        turn_off.callback = self.turn_off_callback
        choose_channel.callback = self.channel_callback
        preview.callback = self.preview_callback
        close.callback = self.close_callback

        self.add_item(turn_on)
        self.add_item(turn_off)
        self.add_item(choose_channel)
        self.add_item(preview)
        self.add_item(close)

    def build_embed(self, guild: discord.Guild):
        config = get_welcome_config()
        channel = guild.get_channel(int(config.get("channel_id") or 0)) if config.get("channel_id") else None
        embed = discord.Embed(
            title="Welcome Settings",
            description="Manage the welcome message for your server.",
            color=0x6EE7B7 if config.get("enabled", True) else 0xED4245,
        )
        embed.add_field(
            name="Status",
            value="On" if config.get("enabled", True) else "Off",
            inline=True,
        )
        embed.add_field(
            name="Channel",
            value=channel.mention if channel else "Not set",
            inline=True,
        )
        embed.set_footer(text="IND Blades")
        embed.timestamp = discord.utils.utcnow()
        return embed

    async def refresh_message(self):
        self.refresh_items()
        if self.message:
            await self.message.edit(embed=self.build_embed(self.interaction.guild), view=self)

    async def on_timeout(self):
        for child in self.children:
            child.disabled = True
        if getattr(self, "message", None):
            await self.message.edit(view=self)

    async def update_state(self, interaction: discord.Interaction, enabled: bool):
        config = get_welcome_config()
        config["enabled"] = enabled
        save_welcome_config(config)
        self.refresh_items()
        await interaction.response.edit_message(embed=self.build_embed(interaction.guild), view=self)

    async def turn_on_callback(self, interaction: discord.Interaction):
        await self.update_state(interaction, True)

    async def turn_off_callback(self, interaction: discord.Interaction):
        await self.update_state(interaction, False)

    async def channel_callback(self, interaction: discord.Interaction):
        await interaction.response.send_message(
            "Choose the welcome channel below.",
            view=WelcomeChannelView(),
            ephemeral=True,
        )

    async def preview_callback(self, interaction: discord.Interaction):
        embed = generate_welcome_embed(interaction.user)
        if os.path.exists(GIF_PATH):
            embed.set_image(url="attachment://ind-blades.gif")
            file = discord.File(GIF_PATH, filename="ind-blades.gif")
            await interaction.response.send_message(embed=embed, file=file, ephemeral=True)
            return
        await interaction.response.send_message(embed=embed, ephemeral=True)

    async def close_callback(self, interaction: discord.Interaction):
        for child in self.children:
            child.disabled = True
        await interaction.response.edit_message(view=self)


class Welcome(commands.Cog):
    welcome_group = app_commands.Group(name="welcome", description="Welcome commands")

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.command_worker.start()

    def cog_unload(self):
        self.command_worker.cancel()

    async def get_target_channel(self, guild: discord.Guild, override_channel_id=None):
        config = get_welcome_config()
        channel_id = override_channel_id or config.get("channel_id")
        if not channel_id:
            return None
        resolved_id = int(channel_id)
        channel = guild.get_channel(resolved_id) or self.bot.get_channel(resolved_id)
        if channel:
            return channel
        try:
            return await self.bot.fetch_channel(resolved_id)
        except Exception:
            return None

    async def send_welcome_message(self, member: discord.Member, mention=True, override_channel_id=None):
        channel = await self.get_target_channel(member.guild, override_channel_id)
        if not channel:
            return False

        embed = generate_welcome_embed(member)
        if os.path.exists(GIF_PATH):
            embed.set_image(url="attachment://ind-blades.gif")
            file = discord.File(GIF_PATH, filename="ind-blades.gif")
            await channel.send(content=member.mention if mention else None, embed=embed, file=file)
        else:
            await channel.send(content=member.mention if mention else None, embed=embed)
        return True

    async def send_preview_message(self, guild: discord.Guild, override_channel_id=None):
        user_id = self.bot.user.id if self.bot.user else None
        preview_member = guild.get_member(user_id) if user_id else None
        if not preview_member and user_id:
            try:
                preview_member = await guild.fetch_member(user_id)
            except Exception:
                preview_member = guild.me
        
        if not preview_member:
            preview_member = guild.me
            
        if not preview_member:
            if self.bot.user:
                preview_member = type(
                    "PreviewMember",
                    (),
                    {
                        "mention": f"<@{self.bot.user.id}>",
                        "avatar": self.bot.user.display_avatar,
                        "guild": guild,
                    },
                )()
        if not preview_member:
            return False
        return await self.send_welcome_message(preview_member, mention=False, override_channel_id=override_channel_id)

    @tasks.loop(seconds=5)
    async def command_worker(self):
        commands_list = load_commands()
        updated = False

        for command in commands_list:
            if command.get("status") == "pending" and command.get("type") == "welcome_preview":
                command["status"] = "processing"
                updated = True

        if updated:
            save_commands(commands_list)

        for command in commands_list:
            if command.get("status") != "processing" or command.get("type") != "welcome_preview":
                continue

            guild = self.bot.guilds[0] if self.bot.guilds else None
            try:
                if not guild:
                    raise RuntimeError("Guild not available")
                sent = await self.send_preview_message(guild, command.get("payload", {}).get("channel_id"))
                if not sent:
                    raise RuntimeError("Unable to send preview")
                command["status"] = "completed"
            except Exception as error:
                command["status"] = "failed"
                command["error"] = str(error)
            finally:
                command["completed_at"] = discord.utils.utcnow().isoformat()
                save_commands(commands_list)

    @command_worker.before_loop
    async def before_command_worker(self):
        await self.bot.wait_until_ready()

    @welcome_group.command(name="panel", description="Open the welcome panel")
    async def welcome_panel(self, interaction: discord.Interaction):
        if not interaction.user.guild_permissions.manage_guild:
            await interaction.response.send_message("You do not have permission to use this.", ephemeral=True)
            return

        view = WelcomePanel(self, interaction)
        await interaction.response.send_message(embed=view.build_embed(interaction.guild), view=view)
        view.message = await interaction.original_response()

    @commands.Cog.listener()
    async def on_member_join(self, member: discord.Member):
        config = get_welcome_config()
        if not config.get("enabled", True):
            return

        role = member.guild.get_role(MEMBER_ROLE_ID)
        if role:
            try:
                await member.add_roles(role, reason="Auto-assigned member role on join")
            except Exception:
                pass

        await asyncio.sleep(1.5)
        await self.send_welcome_message(member, mention=True)


async def setup(bot: commands.Bot):
    await bot.add_cog(Welcome(bot))
