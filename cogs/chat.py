import asyncio
import json
import os
from datetime import timedelta

import discord
from discord.ext import commands, tasks

from utils.desi_chat import DesiChatBrain

COMMANDS_PATH = os.path.join("data", "commands.json")
SUPPORTED_CHAT_COMMAND_TYPES = {"bot_chat_send"}
ALLOWED_MENTIONS = discord.AllowedMentions(everyone=False, roles=False, users=True, replied_user=False)
SAFE_REPLY_MENTIONS = discord.AllowedMentions.none()


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


def parse_iso(value):
    if not value:
        return None
    try:
        return discord.utils.parse_time(value)
    except Exception:
        return None


def mark_command_done(command, note=None):
    command["status"] = "done"
    command.pop("error", None)
    command.pop("retry_at", None)
    command.pop("processing_started_at", None)
    command["completed_at"] = discord.utils.utcnow().isoformat()
    if note:
        command["note"] = note
    else:
        command.pop("note", None)


def mark_command_failed(command, error):
    attempts = int(command.get("attempts", 0) or 0)
    max_attempts = int(command.get("max_attempts", 5) or 5)
    retry_delay_seconds = min(60, max(5, attempts * 5))

    command["status"] = "failed"
    command["error"] = str(error)
    command["completed_at"] = discord.utils.utcnow().isoformat()
    command.pop("processing_started_at", None)

    if attempts < max_attempts:
        command["retry_at"] = (discord.utils.utcnow() + timedelta(seconds=retry_delay_seconds)).isoformat()
    else:
        command.pop("retry_at", None)

class Chat(commands.Cog):
    def __init__(self, bot):
        self.bot = bot
        self.brain = DesiChatBrain()
        self.command_worker.start()

    def cog_unload(self):
        self.command_worker.cancel()

    async def resolve_channel(self, channel_id: str):
        if not channel_id:
            return None

        resolved_id = int(channel_id)
        channel = self.bot.get_channel(resolved_id)
        if channel:
            return channel

        try:
            return await self.bot.fetch_channel(resolved_id)
        except Exception:
            return None

    async def send_dashboard_message(self, payload: dict):
        channel = await self.resolve_channel(str(payload.get("channel_id") or "").strip())
        if not channel or not hasattr(channel, "send") or not hasattr(channel, "typing"):
            raise RuntimeError("Target channel is unavailable for bot chat.")

        content = str(payload.get("content") or "").strip()
        if not content:
            raise RuntimeError("Bot chat content is empty.")

        reply_target = None
        reply_to_message_id = str(payload.get("reply_to_message_id") or "").strip()
        if reply_to_message_id and hasattr(channel, "fetch_message"):
            try:
                reply_target = await channel.fetch_message(int(reply_to_message_id))
            except Exception:
                reply_target = None

        typing_delay = max(0.8, min(4.5, round(0.55 + (len(content) / 45), 2)))
        async with channel.typing():
            await asyncio.sleep(typing_delay)

        if reply_target:
            return await reply_target.reply(
                content,
                mention_author=False,
                allowed_mentions=ALLOWED_MENTIONS,
            )

        return await channel.send(content, allowed_mentions=ALLOWED_MENTIONS)

    @tasks.loop(seconds=3)
    async def command_worker(self):
        commands_list = load_commands()
        updated = False
        now = discord.utils.utcnow()

        for command in commands_list:
            if command.get("type") not in SUPPORTED_CHAT_COMMAND_TYPES:
                continue

            status = command.get("status")
            attempts = int(command.get("attempts", 0) or 0)
            max_attempts = int(command.get("max_attempts", 5) or 5)

            if status == "processing":
                started_at = parse_iso(command.get("processing_started_at"))
                if not started_at or (now - started_at).total_seconds() >= 90:
                    command["status"] = "pending"
                    command.pop("processing_started_at", None)
                    updated = True
                    status = "pending"

            if status == "failed" and attempts < max_attempts:
                retry_at = parse_iso(command.get("retry_at"))
                if not retry_at or retry_at <= now:
                    command["status"] = "pending"
                    command.pop("retry_at", None)
                    updated = True
                    status = "pending"

            if status == "pending":
                available_at = parse_iso(command.get("available_at"))
                if available_at and available_at > now:
                    continue
                command["status"] = "processing"
                command["attempts"] = attempts + 1
                command["processing_started_at"] = now.isoformat()
                updated = True

        if updated:
            save_commands(commands_list)

        for command in commands_list:
            if command.get("type") not in SUPPORTED_CHAT_COMMAND_TYPES:
                continue
            if command.get("status") != "processing":
                continue

            try:
                await self.send_dashboard_message(command.get("payload", {}))
            except Exception as error:
                mark_command_failed(command, error)
                save_commands(commands_list)
                continue

            mark_command_done(command)
            save_commands(commands_list)

    @command_worker.before_loop
    async def before_command_worker(self):
        await self.bot.wait_until_ready()

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot:
            return

        if not self.brain.should_engage(message, self.bot.user):
            return

        plan = self.brain.build_plan(message, self.bot.user.id if self.bot.user else None)

        async with message.channel.typing():
            await asyncio.sleep(plan.typing_delay)

        try:
            if plan.reaction:
                await message.add_reaction(plan.reaction)
        except Exception:
            pass

        await message.reply(
            plan.response,
            mention_author=False,
            allowed_mentions=SAFE_REPLY_MENTIONS,
        )

async def setup(bot):
    await bot.add_cog(Chat(bot))
