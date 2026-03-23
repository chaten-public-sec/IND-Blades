import asyncio
import os
import uuid
from datetime import datetime, timedelta, timezone

import discord
from discord import app_commands
from discord.ext import commands, tasks

from utils.storage import load_data, save_data

IST = timezone(timedelta(hours=5, minutes=30))
GOING_EMOJI = "✅"
NOT_SURE_EMOJI = "❌"
REMINDER_CHANNEL_ID = int(os.getenv("REMINDER_CHANNEL_ID", "0") or 0)
FAMILY_ROLE_ID = int(os.getenv("FAMILY_ROLE_ID", "0") or 0)
GUILD_ID = int(os.getenv("GUILD_ID", "0") or 0)
GIF_PATH = "assets/ind-blades.gif"


def normalize_id(value):
    if value in (None, ""):
        return None
    return str(value)


def load_reminders():
    data = load_data()
    reminders = {}

    for key, value in data.items():
        if str(key).startswith("__") or not isinstance(value, dict):
            continue

        reminder_id = str(value.get("id") or key)
        delivery_mode = "dm" if value.get("delivery_mode") == "dm" else "server"
        target_type = value.get("target_type")

        if target_type not in {"channel", "role", "user"}:
            target_type = "user" if delivery_mode == "dm" else "channel"

        target_id = normalize_id(
            value.get("target_id")
            or (value.get("creator_id") if target_type == "user" else None)
            or (value.get("channel_id") if target_type == "channel" else None)
        )

        reminders[reminder_id] = {
            "id": reminder_id,
            "time": str(value.get("time") or ""),
            "desc": str(value.get("desc") or value.get("name") or "Untitled Event"),
            "daily": bool(value.get("daily", False)),
            "attending": [str(user_id) for user_id in (value.get("attending") or value.get("going") or []) if user_id is not None],
            "not_attending": [str(user_id) for user_id in (value.get("not_attending") or value.get("not_sure") or []) if user_id is not None],
            "vote_message_id": normalize_id(value.get("vote_message_id")),
            "vote_message_map": {
                str(user_id): str(message_id)
                for user_id, message_id in (value.get("vote_message_map") or {}).items()
                if user_id is not None and message_id is not None
            },
            "last_vote_date": value.get("last_vote_date"),
            "last_reminded_date": value.get("last_reminded_date"),
            "event_date": value.get("event_date"),
            "voting_closed": bool(value.get("voting_closed", False)),
            "channel_id": normalize_id(value.get("channel_id")),
            "mention_role_id": normalize_id(value.get("mention_role_id")),
            "enabled": bool(value.get("enabled", True)),
            "delivery_mode": delivery_mode,
            "creator_id": normalize_id(value.get("creator_id")),
            "target_type": target_type,
            "target_id": target_id,
        }

    return reminders


def save_reminders(reminders):
    data = load_data()
    meta = {key: value for key, value in data.items() if str(key).startswith("__")}
    next_data = dict(meta)

    for reminder_id, reminder in reminders.items():
        next_data[str(reminder_id)] = reminder

    save_data(next_data)


def get_gif_file():
    if os.path.exists(GIF_PATH):
        return discord.File(GIF_PATH, filename="ind-blades.gif")
    return None


class EditEventModal(discord.ui.Modal, title="Edit Event"):
    def __init__(self, panel_view, reminder_id):
        super().__init__()
        self.panel_view = panel_view
        self.reminder_id = reminder_id
        reminder = panel_view.cog.reminders.get(reminder_id, {})

        self.name_input = discord.ui.TextInput(
            label="Event Name",
            default=reminder.get("desc", ""),
            max_length=80,
        )
        self.time_input = discord.ui.TextInput(
            label="Time (HH:MM 24h)",
            default=reminder.get("time", ""),
            placeholder="18:30",
            max_length=5,
        )

        self.add_item(self.name_input)
        self.add_item(self.time_input)

    async def on_submit(self, interaction: discord.Interaction):
        try:
            datetime.strptime(str(self.time_input.value).strip(), "%H:%M")
        except ValueError:
            await interaction.response.send_message("Time must use HH:MM format.", ephemeral=True)
            return

        await self.panel_view.cog.sync_reminders()
        reminder = self.panel_view.cog.reminders.get(self.reminder_id)

        if not reminder:
            await interaction.response.send_message("That event no longer exists.", ephemeral=True)
            return

        original_time = reminder.get("time")
        reminder["desc"] = str(self.name_input.value).strip() or reminder["desc"]
        reminder["time"] = str(self.time_input.value).strip()

        if reminder["time"] != original_time:
            reminder["vote_message_id"] = None
            reminder["vote_message_map"] = {}
            reminder["last_vote_date"] = None
            reminder["last_reminded_date"] = None
            reminder["event_date"] = None
            reminder["voting_closed"] = False

        save_reminders(self.panel_view.cog.reminders)
        self.panel_view.sync_page()
        await interaction.response.send_message("Updated.", ephemeral=True)
        await self.panel_view.refresh_message()

        guild = interaction.guild or self.panel_view.cog.get_guild()
        self.panel_view.cog.bot.dispatch(
            "event_state_change",
            guild,
            reminder,
            "Event updated",
            interaction.user,
        )


class ChangeChannelSelect(discord.ui.ChannelSelect):
    def __init__(self, panel_view, reminder_id):
        super().__init__(
            placeholder="Select a channel",
            min_values=1,
            max_values=1,
            channel_types=[discord.ChannelType.text],
        )
        self.panel_view = panel_view
        self.reminder_id = reminder_id

    async def callback(self, interaction: discord.Interaction):
        await self.panel_view.cog.sync_reminders()
        reminder = self.panel_view.cog.reminders.get(self.reminder_id)

        if not reminder:
            await interaction.response.send_message("That event no longer exists.", ephemeral=True)
            return

        channel = self.values[0]
        previous_channel_id = reminder.get("channel_id")
        reminder["target_type"] = "channel"
        reminder["target_id"] = str(channel.id)
        reminder["channel_id"] = str(channel.id)
        reminder["delivery_mode"] = "server"
        save_reminders(self.panel_view.cog.reminders)

        await interaction.response.send_message("Saved successfully.", ephemeral=True)
        await self.panel_view.refresh_message()
        self.panel_view.cog.bot.dispatch(
            "event_channel_change",
            interaction.guild,
            reminder,
            previous_channel_id,
            str(channel.id),
            interaction.user,
        )


class ChangeChannelView(discord.ui.View):
    def __init__(self, panel_view, reminder_id):
        super().__init__(timeout=60)
        self.add_item(ChangeChannelSelect(panel_view, reminder_id))


class EventPicker(discord.ui.Select):
    def __init__(self, panel_view):
        self.panel_view = panel_view
        options = []

        for reminder in panel_view.current_page_items():
            target_text = panel_view.cog.describe_target(reminder)
            options.append(
                discord.SelectOption(
                    label=reminder["desc"][:100],
                    description=f'{reminder["time"]} • {target_text[:80]}',
                    value=reminder["id"],
                    default=reminder["id"] == panel_view.selected_id,
                )
            )

        if not options:
            options.append(
                discord.SelectOption(
                    label="No events available",
                    description="Create an event first",
                    value="none",
                    default=True,
                )
            )

        super().__init__(placeholder="Select an event", options=options, row=0, disabled=options[0].value == "none")

    async def callback(self, interaction: discord.Interaction):
        selected_id = self.values[0]
        if selected_id == "none":
            await interaction.response.defer()
            return

        self.panel_view.selected_id = selected_id
        self.panel_view.sync_page()
        await interaction.response.edit_message(embed=self.panel_view.build_embed(), view=self.panel_view)


class ConfirmDeleteView(discord.ui.View):
    def __init__(self, panel_view, reminder_id):
        super().__init__(timeout=60)
        self.panel_view = panel_view
        self.reminder_id = reminder_id

    @discord.ui.button(label="Delete", style=discord.ButtonStyle.danger)
    async def confirm(self, interaction: discord.Interaction, button: discord.ui.Button):
        await self.panel_view.cog.sync_reminders()
        reminder = self.panel_view.cog.reminders.pop(self.reminder_id, None)

        if not reminder:
            await interaction.response.edit_message(content="That event no longer exists.", view=None)
            return

        save_reminders(self.panel_view.cog.reminders)
        self.panel_view.sync_page()
        await interaction.response.edit_message(content="Deleted.", view=None)
        await self.panel_view.refresh_message()
        self.panel_view.cog.bot.dispatch(
            "event_state_change",
            interaction.guild,
            reminder,
            "Event deleted",
            interaction.user,
        )

    @discord.ui.button(label="Cancel", style=discord.ButtonStyle.secondary)
    async def cancel(self, interaction: discord.Interaction, button: discord.ui.Button):
        await interaction.response.edit_message(content="Cancelled.", view=None)


class EventPanelView(discord.ui.View):
    def __init__(self, cog, selected_id=None, page=0):
        super().__init__(timeout=300)
        self.cog = cog
        self.selected_id = selected_id
        self.page = page
        self.message = None
        self.sync_page()
        self.refresh_items()

    def sorted_items(self):
        return sorted(
            self.cog.reminders.values(),
            key=lambda reminder: (reminder.get("time") or "99:99", reminder.get("desc", "").lower()),
        )

    def total_pages(self):
        items = self.sorted_items()
        return max(1, (len(items) + 4) // 5)

    def current_page_items(self):
        items = self.sorted_items()
        start = self.page * 5
        return items[start : start + 5]

    def selected_reminder(self):
        if self.selected_id and self.selected_id in self.cog.reminders:
            return self.cog.reminders[self.selected_id]

        page_items = self.current_page_items()
        return page_items[0] if page_items else None

    def sync_page(self):
        items = self.sorted_items()
        page_total = max(1, (len(items) + 4) // 5)
        self.page = min(max(self.page, 0), page_total - 1)

        current_ids = {reminder["id"] for reminder in self.current_page_items()}
        if self.selected_id not in self.cog.reminders or self.selected_id not in current_ids:
            page_items = self.current_page_items()
            self.selected_id = page_items[0]["id"] if page_items else None

    def refresh_items(self):
        self.clear_items()

        picker = EventPicker(self)
        self.add_item(picker)

        selected = self.selected_reminder()
        can_change_channel = bool(
            selected
            and selected.get("delivery_mode") == "server"
            and selected.get("target_type") == "channel"
        )

        prev_button = discord.ui.Button(
            label="⬅️",
            style=discord.ButtonStyle.secondary,
            row=1,
            disabled=self.page == 0,
        )
        next_button = discord.ui.Button(
            label="➡️",
            style=discord.ButtonStyle.secondary,
            row=1,
            disabled=self.page >= self.total_pages() - 1,
        )
        toggle_button = discord.ui.Button(
            label="Turn Off" if selected and selected.get("enabled", True) else "Turn On",
            style=discord.ButtonStyle.secondary,
            row=1,
            disabled=selected is None,
        )
        edit_button = discord.ui.Button(
            label="Edit",
            style=discord.ButtonStyle.primary,
            row=1,
            disabled=selected is None,
        )
        channel_button = discord.ui.Button(
            label="Change Channel",
            style=discord.ButtonStyle.secondary,
            row=2,
            disabled=not can_change_channel,
        )
        toggle_mode_button = discord.ui.Button(
            label="Swap to DM Mode" if selected and selected.get("delivery_mode") == "server" else "Swap to Server",
            style=discord.ButtonStyle.secondary,
            row=2,
            disabled=selected is None,
        )
        delete_button = discord.ui.Button(
            label="Delete",
            style=discord.ButtonStyle.danger,
            row=2,
            disabled=selected is None,
        )
        close_button = discord.ui.Button(
            label="❌",
            style=discord.ButtonStyle.secondary,
            row=2,
        )

        async def prev_callback(interaction: discord.Interaction):
            self.page = max(0, self.page - 1)
            self.sync_page()
            self.refresh_items()
            await interaction.response.edit_message(embed=self.build_embed(), view=self)

        async def next_callback(interaction: discord.Interaction):
            self.page = min(self.total_pages() - 1, self.page + 1)
            self.sync_page()
            self.refresh_items()
            await interaction.response.edit_message(embed=self.build_embed(), view=self)

        async def toggle_callback(interaction: discord.Interaction):
            reminder = self.selected_reminder()
            if not reminder:
                await interaction.response.send_message("Select an event first.", ephemeral=True)
                return

            await self.cog.sync_reminders()
            reminder = self.cog.reminders.get(reminder["id"])
            if not reminder:
                await interaction.response.send_message("That event no longer exists.", ephemeral=True)
                return

            reminder["enabled"] = not reminder.get("enabled", True)
            save_reminders(self.cog.reminders)
            self.sync_page()
            self.refresh_items()
            await interaction.response.edit_message(embed=self.build_embed(), view=self)
            self.cog.bot.dispatch(
                "event_state_change",
                interaction.guild,
                reminder,
                "Event enabled" if reminder["enabled"] else "Event disabled",
                interaction.user,
            )

        async def edit_callback(interaction: discord.Interaction):
            reminder = self.selected_reminder()
            if not reminder:
                await interaction.response.send_message("Select an event first.", ephemeral=True)
                return

            await interaction.response.send_modal(EditEventModal(self, reminder["id"]))

        async def channel_callback(interaction: discord.Interaction):
            reminder = self.selected_reminder()
            if not reminder:
                await interaction.response.send_message("Select an event first.", ephemeral=True)
                return

            await interaction.response.send_message(
                "Select the new channel below.",
                view=ChangeChannelView(self, reminder["id"]),
                ephemeral=True,
            )

        async def toggle_mode_callback(interaction: discord.Interaction):
            reminder = self.selected_reminder()
            if not reminder:
                await interaction.response.send_message("Select an event first.", ephemeral=True)
                return

            await self.cog.sync_reminders()
            reminder = self.cog.reminders.get(reminder["id"])
            if not reminder: return

            current_mode = reminder.get("delivery_mode", "server")
            if current_mode == "server":
                reminder["delivery_mode"] = "dm"
                reminder["target_type"] = "user"
                reminder["target_id"] = reminder.get("creator_id")
            else:
                reminder["delivery_mode"] = "server"
                reminder["target_type"] = "channel"
                reminder["target_id"] = reminder.get("channel_id")

            save_reminders(self.cog.reminders)
            self.sync_page()
            self.refresh_items()
            await interaction.response.edit_message(embed=self.build_embed(), view=self)

        async def delete_callback(interaction: discord.Interaction):
            reminder = self.selected_reminder()
            if not reminder:
                await interaction.response.send_message("Select an event first.", ephemeral=True)
                return

            await interaction.response.send_message(
                "Delete this event?",
                view=ConfirmDeleteView(self, reminder["id"]),
                ephemeral=True,
            )

        async def close_callback(interaction: discord.Interaction):
            for child in self.children:
                child.disabled = True
            await interaction.response.edit_message(view=self)

        prev_button.callback = prev_callback
        next_button.callback = next_callback
        toggle_button.callback = toggle_callback
        edit_button.callback = edit_callback
        channel_button.callback = channel_callback
        toggle_mode_button.callback = toggle_mode_callback
        delete_button.callback = delete_callback
        close_button.callback = close_callback

        self.add_item(prev_button)
        self.add_item(next_button)
        self.add_item(toggle_button)
        self.add_item(edit_button)
        self.add_item(channel_button)
        self.add_item(toggle_mode_button)
        self.add_item(delete_button)
        self.add_item(close_button)

    def build_embed(self):
        selected = self.selected_reminder()
        page_items = self.current_page_items()
        title = "IND Blades Event Panel"

        if page_items:
            blocks = []
            for reminder in page_items:
                mode_label = "Off" if not reminder.get("enabled", True) else ("DM" if reminder.get("delivery_mode") == "dm" else "Server")
                blocks.append(f'{reminder["desc"]}\nMode: {mode_label}')
            list_text = "\n\n".join(blocks)
        else:
            list_text = "No events created yet."

        embed = discord.Embed(
            title=title,
            description=list_text,
            color=0x51A7FF,
        )
        embed.set_author(name=f"Page {self.page + 1}/{self.total_pages()}")

        if selected:
            repeat_label = "Daily" if selected.get("daily") else "One time"
            mode_label = "DM" if selected.get("delivery_mode") == "dm" else "Server"
            status_label = "On" if selected.get("enabled", True) else "Off"
            embed.add_field(
                name=selected.get("desc", "Selected Event"),
                value=(
                    f'Time: {selected.get("time", "Not set")} IST\n'
                    f"Repeat: {repeat_label}\n"
                    f"Mode: {mode_label}\n"
                    f"Target: {self.cog.describe_target(selected)}\n"
                    f"Status: {status_label}"
                ),
                inline=False,
            )

        embed.set_footer(text="IND Blades")
        embed.timestamp = discord.utils.utcnow()
        return embed

    async def refresh_message(self):
        if not self.message:
            return

        await self.cog.sync_reminders()
        self.sync_page()
        self.refresh_items()
        await self.message.edit(embed=self.build_embed(), view=self)

    async def on_timeout(self):
        for child in self.children:
            child.disabled = True

        if self.message:
            await self.message.edit(view=self)


class VotingView(discord.ui.View):
    def __init__(self, cog, reminder_id, closed=False):
        super().__init__(timeout=None)
        self.cog = cog
        self.reminder_id = reminder_id

        attend_btn = discord.ui.Button(
            label="✅ Attend",
            style=discord.ButtonStyle.success,
            custom_id=f"vote_attend_{reminder_id}",
            disabled=closed,
        )
        not_attend_btn = discord.ui.Button(
            label="❌ Not Attending",
            style=discord.ButtonStyle.danger,
            custom_id=f"vote_notattend_{reminder_id}",
            disabled=closed,
        )

        async def attend_callback(interaction: discord.Interaction):
            await self.cog.sync_reminders()
            reminder = self.cog.reminders.get(self.reminder_id)
            if not reminder or reminder.get("voting_closed"):
                await interaction.response.send_message("Voting is closed.", ephemeral=True)
                return

            user_id = str(interaction.user.id)
            attending = set(reminder.get("attending", []))
            not_attending = set(reminder.get("not_attending", []))

            attending.add(user_id)
            not_attending.discard(user_id)

            reminder["attending"] = sorted(attending)
            reminder["not_attending"] = sorted(not_attending)
            save_reminders(self.cog.reminders)

            await interaction.response.send_message(
                "Join the Fam Event VC 🎧\nClick below to join",
                ephemeral=True,
            )
            await self.cog.refresh_vote_messages(self.reminder_id)

        async def not_attend_callback(interaction: discord.Interaction):
            await self.cog.sync_reminders()
            reminder = self.cog.reminders.get(self.reminder_id)
            if not reminder or reminder.get("voting_closed"):
                await interaction.response.send_message("Voting is closed.", ephemeral=True)
                return

            user_id = str(interaction.user.id)
            attending = set(reminder.get("attending", []))
            not_attending = set(reminder.get("not_attending", []))

            not_attending.add(user_id)
            attending.discard(user_id)

            reminder["attending"] = sorted(attending)
            reminder["not_attending"] = sorted(not_attending)
            save_reminders(self.cog.reminders)

            await interaction.response.defer()
            await self.cog.refresh_vote_messages(self.reminder_id)

        attend_btn.callback = attend_callback
        not_attend_btn.callback = not_attend_callback

        self.add_item(attend_btn)
        self.add_item(not_attend_btn)


class Reminders(commands.Cog):
    event_group = app_commands.Group(name="event", description="Event commands")

    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.reminders = load_reminders()
        self.scheduler.start()

    def cog_unload(self):
        self.scheduler.cancel()

    async def sync_reminders(self):
        self.reminders = load_reminders()
        return self.reminders

    def get_guild(self):
        if GUILD_ID:
            guild = self.bot.get_guild(GUILD_ID)
            if guild:
                return guild
        return self.bot.guilds[0] if self.bot.guilds else None

    def get_channel(self, channel_id):
        if not channel_id:
            return None
        guild = self.get_guild()
        if not guild:
            return None
        return guild.get_channel(int(channel_id))

    def describe_target(self, reminder):
        target_type = reminder.get("target_type")
        target_id = reminder.get("target_id")

        if target_type == "channel" and target_id:
            return f"<#{target_id}>"
        if target_type == "role" and target_id:
            return f"<@&{target_id}>"
        if target_type == "user" and target_id:
            return f"<@{target_id}>"
        return "Not set"

    def voting_embed(self, reminder, closed=False):
        status_text = "Voting closed" if closed else "⚡ Join the event or you may get a strike"
        color = 0xED4245 if closed else 0x51A7FF
        attending_list = self.format_list(reminder.get("attending", []))
        not_attending_list = self.format_list(reminder.get("not_attending", []))

        embed = discord.Embed(
            title=f"📅 {reminder.get('desc', 'Event')}",
            description=(
                f"{status_text}\n"
                "━━━━━━━━━━━━━━━━━━\n"
                f"Time: {reminder.get('time', 'Not set')} IST\n"
                f"Target: {self.describe_target(reminder)}"
            ),
            color=color,
        )
        embed.add_field(
            name=f"✅ Attending ({len(reminder.get('attending', []))})",
            value=attending_list,
            inline=False,
        )
        embed.add_field(
            name=f"❌ Not Attending ({len(reminder.get('not_attending', []))})",
            value=not_attending_list,
            inline=False,
        )
        embed.set_footer(text="IND Blades")
        embed.timestamp = discord.utils.utcnow()
        return embed

    def reminder_embed(self, reminder):
        embed = discord.Embed(
            title=f"🔔 {reminder.get('desc', 'Event')}",
            description=(
                "Starting now\n"
                "━━━━━━━━━━━━━━━━━━\n"
                f"Mode: {'DM' if reminder.get('delivery_mode') == 'dm' else 'Server'}\n"
                f"Time: {reminder.get('time', 'Not set')} IST"
            ),
            color=0x6EE7B7,
        )
        embed.add_field(
            name=f"✅ Attending ({len(reminder.get('attending', []))})",
            value=self.format_list(reminder.get("attending", [])),
            inline=False,
        )
        embed.set_footer(text="IND Blades")
        embed.timestamp = discord.utils.utcnow()
        return embed

    def format_list(self, users):
        if not users:
            return "None yet"
        return "\n".join(f"• <@{user_id}>" for user_id in users)

    def server_target_channel(self, reminder):
        if reminder.get("target_type") == "channel" and reminder.get("target_id"):
            return self.get_channel(reminder.get("target_id"))
        return self.get_channel(reminder.get("channel_id")) or self.get_channel(str(REMINDER_CHANNEL_ID))

    def server_target_content(self, reminder, label):
        target_type = reminder.get("target_type")
        target_id = reminder.get("target_id")
        mention_role_id = reminder.get("mention_role_id")

        mention = ""
        if target_type == "role" and target_id:
            mention = f"<@&{target_id}> "
        elif mention_role_id:
            mention = f"<@&{mention_role_id}> "
        elif FAMILY_ROLE_ID and self.get_guild() and self.get_guild().get_role(FAMILY_ROLE_ID):
            mention = f"<@&{FAMILY_ROLE_ID}> "

        return f"{mention}{label} {reminder.get('desc', 'Event')}".strip()

    async def dm_targets(self, reminder):
        target_type = reminder.get("target_type")
        target_id = reminder.get("target_id")
        if not target_id:
            return []

        if target_type == "user":
            try:
                user = await self.bot.fetch_user(int(target_id))
                return [user] if user and not user.bot else []
            except Exception:
                return []

        if target_type == "role":
            guild = self.get_guild()
            if not guild:
                return []
            role = guild.get_role(int(target_id))
            if not role:
                return []
            return [member for member in role.members if not member.bot]

        return []

    async def dm_channel(self, user):
        try:
            return await user.create_dm()
        except Exception:
            return None

    async def send_payload(self, destination, content, embed):
        gif = get_gif_file()
        if gif:
            embed = embed.copy()
            embed.set_image(url="attachment://ind-blades.gif")
            return await destination.send(content=content, embed=embed, file=gif)
        return await destination.send(content=content, embed=embed)

    async def edit_payload(self, message, embed):
        gif = get_gif_file()
        if gif:
            embed = embed.copy()
            embed.set_image(url="attachment://ind-blades.gif")
            return await message.edit(embed=embed, attachments=[gif])
        return await message.edit(embed=embed, attachments=[])

    async def refresh_vote_messages(self, reminder_id):
        reminder = self.reminders.get(reminder_id)
        if not reminder:
            return

        closed = reminder.get("voting_closed", False)

        if reminder.get("vote_message_id"):
            channel = self.server_target_channel(reminder)
            if channel:
                try:
                    message = await channel.fetch_message(int(reminder["vote_message_id"]))
                    await self.edit_payload(message, self.voting_embed(reminder, closed))
                    await message.edit(view=VotingView(self, reminder_id, closed))
                except Exception:
                    pass

        for user_id, message_id in list((reminder.get("vote_message_map") or {}).items()):
            try:
                user = await self.bot.fetch_user(int(user_id))
                dm = await self.dm_channel(user)
                if not dm:
                    continue
                message = await dm.fetch_message(int(message_id))
                await self.edit_payload(message, self.voting_embed(reminder, closed))
                await message.edit(view=VotingView(self, reminder_id, closed))
            except Exception:
                pass

    async def close_vote_messages(self, reminder):
        if reminder.get("vote_message_id"):
            channel = self.server_target_channel(reminder)
            if channel:
                try:
                    message = await channel.fetch_message(int(reminder["vote_message_id"]))
                    await self.edit_payload(message, self.voting_embed(reminder, True))
                    await message.edit(view=VotingView(self, reminder["id"], True))
                except Exception:
                    pass

        for user_id, message_id in list((reminder.get("vote_message_map") or {}).items()):
            try:
                user = await self.bot.fetch_user(int(user_id))
                dm = await self.dm_channel(user)
                if not dm:
                    continue
                message = await dm.fetch_message(int(message_id))
                await self.edit_payload(message, self.voting_embed(reminder, True))
                await message.edit(view=VotingView(self, reminder["id"], True))
            except Exception:
                pass

    async def send_voting(self, reminder_id):
        await self.sync_reminders()
        reminder = self.reminders.get(reminder_id)
        if not reminder or not reminder.get("enabled", True) or reminder.get("voting_closed"):
            return False

        if reminder.get("vote_message_id") or reminder.get("vote_message_map"):
            return False

        sent_any = False
        today = datetime.now(IST).strftime("%Y-%m-%d")
        reminder["vote_message_id"] = None
        reminder["vote_message_map"] = {}

        view = VotingView(self, reminder_id)

        if reminder.get("delivery_mode") == "dm":
            for user in await self.dm_targets(reminder):
                try:
                    dm_view = VotingView(self, reminder_id)
                    message = await self.send_payload(user, f"⏰ Event Voting: {reminder['desc']}", self.voting_embed(reminder))
                    await message.edit(view=dm_view)
                    reminder["vote_message_map"][str(user.id)] = str(message.id)
                    sent_any = True
                except Exception:
                    continue
        else:
            channel = self.server_target_channel(reminder)
            if channel:
                message = await self.send_payload(
                    channel,
                    self.server_target_content(reminder, "⏰ Event Voting:"),
                    self.voting_embed(reminder),
                )
                await message.edit(view=view)
                reminder["vote_message_id"] = str(message.id)
                sent_any = True

        reminder["last_vote_date"] = today
        save_reminders(self.reminders)
        return sent_any

    async def update_vote(self, payload, add):
        if payload.user_id == self.bot.user.id:
            return

        emoji = str(payload.emoji)
        if emoji not in {GOING_EMOJI, NOT_SURE_EMOJI}:
            return

        await self.sync_reminders()
        reminder = None

        for current in self.reminders.values():
            if current.get("vote_message_id") == str(payload.message_id):
                reminder = current
                break
            if str(payload.message_id) in set((current.get("vote_message_map") or {}).values()):
                reminder = current
                break

        if not reminder or reminder.get("voting_closed"):
            return

        user_id = str(payload.user_id)
        attending = set(reminder.get("attending", []))
        not_attending = set(reminder.get("not_attending", []))

        if add:
            if emoji == GOING_EMOJI:
                attending.add(user_id)
                not_attending.discard(user_id)
            else:
                not_attending.add(user_id)
                attending.discard(user_id)
        else:
            if emoji == GOING_EMOJI:
                attending.discard(user_id)
            else:
                not_attending.discard(user_id)

        reminder["attending"] = sorted(attending)
        reminder["not_attending"] = sorted(not_attending)
        save_reminders(self.reminders)
        await self.refresh_vote_messages(reminder["id"])

    @event_group.command(name="create", description="Configure and schedule a new server event.")
    @app_commands.describe(
        time="Execution Time (Format HH:MM 24h) in IST",
        desc="Title of the Event",
        daily="Should this recur every 24 hours?",
        channel="Select a Text/Voice Channel (if Channel Mode)",
        target_role="Select a Server Role (if Role DM Mode)",
        target_user="Select a specific User (if User DM Mode)",
    )
    @app_commands.choices(
        mode=[
            app_commands.Choice(name="Server Messages", value="server"),
            app_commands.Choice(name="Direct Messages", value="dm"),
        ],
        target_type=[
            app_commands.Choice(name="Discord Channel Object", value="channel"),
            app_commands.Choice(name="Discord Role Object", value="role"),
            app_commands.Choice(name="Discord User Object", value="user"),
        ]
    )
    async def create_event(
        self,
        interaction: discord.Interaction,
        time: str,
        desc: str,
        daily: bool = False,
        mode: app_commands.Choice[str] | None = None,
        target_type: app_commands.Choice[str] | None = None,
        channel: discord.TextChannel | None = None,
        target_role: discord.Role | None = None,
        target_user: discord.Member | None = None,
    ):
        try:
            datetime.strptime(time.strip(), "%H:%M")
        except ValueError:
            await interaction.response.send_message("Time must use HH:MM format.", ephemeral=True)
            return

        await self.sync_reminders()
        reminder_id = str(uuid.uuid4())
        
        mode_val = mode.value if mode else "server"
        type_val = target_type.value if target_type else ("user" if mode_val == "dm" else "channel")
        target_id_val = None
        
        if type_val == "channel": target_id_val = str(channel.id) if channel else str(REMINDER_CHANNEL_ID)
        elif type_val == "role": target_id_val = str(target_role.id) if target_role else None
        elif type_val == "user": target_id_val = str(target_user.id) if target_user else str(interaction.user.id)
        
        if not target_id_val:
            await interaction.response.send_message("You must supply the corresponding target parameter (Channel, Role, or User).", ephemeral=True)
            return

        reminder = {
            "id": reminder_id,
            "time": time.strip(),
            "desc": desc.strip(),
            "daily": daily,
            "attending": [],
            "not_attending": [],
            "vote_message_id": None,
            "vote_message_map": {},
            "last_vote_date": None,
            "last_reminded_date": None,
            "event_date": None,
            "voting_closed": False,
            "channel_id": target_id_val if type_val == "channel" else None,
            "mention_role_id": str(FAMILY_ROLE_ID) if FAMILY_ROLE_ID else None,
            "enabled": True,
            "delivery_mode": mode_val,
            "creator_id": str(interaction.user.id),
            "target_type": type_val,
            "target_id": target_id_val,
        }
        self.reminders[reminder_id] = reminder
        save_reminders(self.reminders)

        embed = discord.Embed(
            description=(
                f"✨ **{reminder['desc']}** has been scheduled successfully! ✨\n\n"
                f"**Execution:** ⏰ {reminder['time']} IST\n"
                f"**Recurrence:** 🔁 {'Daily Loop' if reminder['daily'] else 'Single Execution'}\n"
                f"**Routing via:** 📍 {type_val.capitalize()} ({mode_val.upper()})\n\n"
                "Thank you for configuring the matrix! ⚡"
            ),
            color=0x4DA4FF,
        )
        embed.set_footer(text=f"Event ID: {reminder_id} • IND Blades System", icon_url=self.bot.user.display_avatar.url if self.bot.user.avatar else None)
        await interaction.response.send_message(embed=embed)
        self.bot.dispatch("event_state_change", interaction.guild, reminder, "Event created", interaction.user)

    @event_group.command(name="panel", description="Open the live interactive Dashboard Panel inside Discord")
    async def event_panel(self, interaction: discord.Interaction):
        await self.sync_reminders()
        view = EventPanelView(self)
        await interaction.response.send_message(embed=view.build_embed(), view=view)
        view.message = await interaction.original_response()

    @tasks.loop(seconds=30)
    async def scheduler(self):
        await self.sync_reminders()
        now = datetime.now(IST)
        today = now.strftime("%Y-%m-%d")

        for reminder_id, reminder in list(self.reminders.items()):
            try:
                if not reminder.get("enabled", True):
                    continue

                event_time = datetime.combine(
                    now.date(),
                    datetime.strptime(reminder["time"], "%H:%M").time(),
                    tzinfo=IST,
                )
                vote_time = event_time - timedelta(minutes=15)

                if (
                    vote_time <= now < event_time
                    and reminder.get("last_vote_date") != today
                    and reminder.get("event_date") != today
                    and not reminder.get("voting_closed")
                ):
                    await self.send_voting(reminder_id)

                if event_time <= now and reminder.get("last_reminded_date") != today:
                    sent_any = False

                    if reminder.get("delivery_mode") == "dm":
                        for user in await self.dm_targets(reminder):
                            try:
                                await self.send_payload(
                                    user,
                                    f"🔔 Event Starting: {reminder['desc']}",
                                    self.reminder_embed(reminder),
                                )
                                sent_any = True
                            except Exception:
                                continue
                    else:
                        channel = self.server_target_channel(reminder)
                        if channel:
                            await self.send_payload(
                                channel,
                                self.server_target_content(reminder, "🔔 Event Starting:"),
                                self.reminder_embed(reminder),
                            )
                            sent_any = True

                    reminder["last_reminded_date"] = today
                    reminder["event_date"] = today
                    reminder["voting_closed"] = True
                    await self.close_vote_messages(reminder)

                    guild = self.get_guild()
                    if sent_any:
                        self.bot.dispatch("event_executed", guild, reminder, "Event triggered successfully")
                        self.bot.dispatch("check_event_attendance", guild, reminder)

                    if reminder.get("daily"):
                        reminder["going"] = []
                        reminder["not_sure"] = []
                        reminder["vote_message_id"] = None
                        reminder["vote_message_map"] = {}
                        reminder["voting_closed"] = False
                        reminder["event_date"] = None
                    else:
                        self.reminders.pop(reminder_id, None)

                    save_reminders(self.reminders)

            except Exception as error:
                print(f"[Reminder Error] {reminder_id}: {error}")

    @scheduler.before_loop
    async def before_scheduler(self):
        await self.bot.wait_until_ready()

async def setup(bot: commands.Bot):
    await bot.add_cog(Reminders(bot))
