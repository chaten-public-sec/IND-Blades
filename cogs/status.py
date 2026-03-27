import json
import os
from collections import deque
from datetime import datetime
from zoneinfo import ZoneInfo

import discord
from discord.ext import commands, tasks

from utils.storage import load_data
from utils.system_identity import SYSTEM_IDENTITY_LINE, SYSTEM_TAGLINE, SYSTEM_VERSION

COMMANDS_PATH = os.path.join("data", "commands.json")
STATUS_TIMEZONE = os.getenv("BOT_STATUS_TIMEZONE", "Asia/Kolkata")


class Status(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.started_at = discord.utils.utcnow()
        self.message_events = deque()
        self.rotation_index = 0
        self.last_presence_key = ""
        self.timezone = self._resolve_timezone()

    def _resolve_timezone(self):
        try:
            return ZoneInfo(STATUS_TIMEZONE)
        except Exception:
            return None

    def _now_local(self):
        now = discord.utils.utcnow()
        return now.astimezone(self.timezone) if self.timezone else now

    def _trim_message_events(self):
        cutoff = discord.utils.utcnow().timestamp() - 60
        while self.message_events and self.message_events[0] < cutoff:
            self.message_events.popleft()

    def _load_commands(self):
        if not os.path.exists(COMMANDS_PATH):
            return []
        try:
            with open(COMMANDS_PATH, "r", encoding="utf-8") as file_handle:
                payload = json.load(file_handle)
                return payload if isinstance(payload, list) else []
        except Exception:
            return []

    def _list_events(self, data):
        events = []
        for key, value in data.items():
            if key.startswith("__") or not isinstance(value, dict):
                continue
            events.append({"id": key, **value})
        return events

    def _active_strike_count(self, data):
        total = 0
        for strike_data in (data.get("__strikes__", {}) or {}).values():
            for strike in strike_data.get("strikes", []):
                if str(strike.get("status") or "active") == "active":
                    total += 1
        return total

    def _event_delta_minutes(self, event_time: str, now_local: datetime):
        try:
            hours_text, minutes_text = str(event_time or "").split(":", 1)
            target_minutes = (int(hours_text) * 60) + int(minutes_text)
        except Exception:
            return None

        current_minutes = (now_local.hour * 60) + now_local.minute
        delta = target_minutes - current_minutes

        if delta < -720:
            delta += 1440
        elif delta > 720:
            delta -= 1440

        return delta

    def _resolve_live_event(self, events, now_local: datetime):
        for event in events:
            if not event.get("enabled"):
                continue

            event_date = discord.utils.parse_time(str(event.get("event_date") or "")) if event.get("event_date") else None
            if event_date:
                delta_seconds = abs((event_date - discord.utils.utcnow()).total_seconds())
                if delta_seconds <= 5400:
                    return event

            delta_minutes = self._event_delta_minutes(event.get("time"), now_local)
            if delta_minutes is not None and abs(delta_minutes) <= 45:
                return event

        return None

    def _recent_action_flags(self):
        commands_list = self._load_commands()
        now = discord.utils.utcnow()
        flags = {
            "moderation": False,
            "event": False,
        }

        for command in commands_list[-40:]:
            moment = discord.utils.parse_time(str(command.get("completed_at") or command.get("created_at") or ""))
            if not moment or (now - moment).total_seconds() > 900:
                continue

            command_type = str(command.get("type") or "")
            if command_type.startswith("strike_"):
                flags["moderation"] = True
            if command_type.startswith("event_"):
                flags["event"] = True

        return flags

    def collect_metrics(self):
        self._trim_message_events()
        guild = self.bot.guilds[0] if self.bot.guilds else None
        data = load_data()
        now_local = self._now_local()
        events = self._list_events(data)
        enabled_events = [event for event in events if event.get("enabled")]
        live_event = self._resolve_live_event(enabled_events, now_local)
        recent_flags = self._recent_action_flags()

        return {
            "member_count": guild.member_count if guild else 0,
            "active_events": len(enabled_events),
            "active_strikes": self._active_strike_count(data),
            "message_rate": len(self.message_events),
            "live_event": live_event,
            "recent_moderation": recent_flags["moderation"],
            "recent_event": recent_flags["event"],
            "quiet_hours": now_local.hour < 6,
            "daylight": 6 <= now_local.hour < 18,
            "uptime_seconds": int((discord.utils.utcnow() - self.started_at).total_seconds()),
        }

    def determine_mode(self, metrics):
        if metrics["recent_moderation"] or metrics["active_strikes"] >= 3:
            return "lockdown"
        if metrics["live_event"] or metrics["recent_event"]:
            return "event"
        if metrics["quiet_hours"] and metrics["message_rate"] < 4:
            return "silent"
        if metrics["message_rate"] >= 25:
            return "traffic"
        if metrics["daylight"]:
            return "day"
        return "idle"

    def determine_tone(self, mode: str):
        mapping = {
            "lockdown": "strict",
            "event": "energetic",
            "silent": "silent",
            "traffic": "friendly",
            "day": "friendly",
            "idle": "friendly",
        }
        return mapping.get(mode, "friendly")

    def presence_options(self, metrics, mode: str):
        event_name = str((metrics.get("live_event") or {}).get("desc") or "event").strip()[:48]
        options = []

        if mode == "lockdown":
            options.extend([
                (discord.ActivityType.playing, "System secured"),
                (discord.ActivityType.watching, f"{metrics['active_strikes']} strike alerts"),
                (discord.ActivityType.listening, f"{metrics['message_rate']} msgs/min"),
            ])
        elif mode == "event":
            options.extend([
                (discord.ActivityType.playing, f"Hosting {event_name}"),
                (discord.ActivityType.watching, f"{metrics['active_events']} active events"),
                (discord.ActivityType.listening, f"{metrics['message_rate']} msgs/min"),
            ])
        elif mode == "silent":
            options.extend([
                (discord.ActivityType.watching, "Monitoring quietly"),
                (discord.ActivityType.listening, "night traffic"),
                (discord.ActivityType.watching, f"{metrics['member_count']} members"),
            ])
        else:
            options.extend([
                (discord.ActivityType.watching, f"{metrics['member_count']} members"),
                (discord.ActivityType.playing, f"{metrics['active_events']} active events"),
                (discord.ActivityType.watching, f"{metrics['active_strikes']} active strikes"),
                (discord.ActivityType.listening, f"{metrics['message_rate']} msgs/min"),
            ])

            if mode == "day":
                options.append((discord.ActivityType.playing, "Active and managing"))
            else:
                options.append((discord.ActivityType.watching, "Observing silently"))

        return options

    def build_activity(self, activity_type, name: str):
        if activity_type == discord.ActivityType.playing:
            return discord.Game(name=name)
        return discord.Activity(type=activity_type, name=name)

    def refresh_runtime_state(self, metrics, mode: str, presence_label: str = "", activity_type: str = "watching"):
        state = getattr(self.bot, "runtime_state", None)
        if not isinstance(state, dict):
            return

        state.update({
            "presence_mode": mode,
            "reply_tone": self.determine_tone(mode),
            "silent_mode": mode == "silent",
            "identity_line": f"{SYSTEM_IDENTITY_LINE} | {SYSTEM_VERSION}",
            "tagline": SYSTEM_TAGLINE,
            "member_count": metrics["member_count"],
            "active_events": metrics["active_events"],
            "active_strikes": metrics["active_strikes"],
            "message_rate": metrics["message_rate"],
            "uptime_seconds": metrics["uptime_seconds"],
            "profile_line": (
                f"{SYSTEM_VERSION} | {metrics['member_count']} users monitored | "
                f"{metrics['active_events']} events | {metrics['active_strikes']} strikes"
            ),
            "current_presence_text": presence_label or str(state.get("current_presence_text") or ""),
            "current_presence_type": activity_type or str(state.get("current_presence_type") or "watching"),
            "last_presence_at": discord.utils.utcnow().isoformat(),
        })

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return

        self.message_events.append(discord.utils.utcnow().timestamp())
        self._trim_message_events()

    async def cog_load(self):
        self.change_status.start()

    async def cog_unload(self):
        self.change_status.cancel()

    @tasks.loop(seconds=20)
    async def change_status(self):
        metrics = self.collect_metrics()
        mode = self.determine_mode(metrics)
        options = self.presence_options(metrics, mode) or [(discord.ActivityType.watching, "the server")]

        activity_type, label = options[self.rotation_index % len(options)]
        self.rotation_index += 1

        self.refresh_runtime_state(metrics, mode, label, getattr(activity_type, "name", str(activity_type)))

        presence_key = f"{mode}:{activity_type}:{label}"
        if presence_key == self.last_presence_key:
            return

        self.last_presence_key = presence_key
        await self.bot.change_presence(activity=self.build_activity(activity_type, label))

        publish_runtime_state = getattr(self.bot, "publish_runtime_state", None)
        if callable(publish_runtime_state):
            await publish_runtime_state(True)

    @change_status.before_loop
    async def before_change_status(self):
        await self.bot.wait_until_ready()


async def setup(bot: commands.Bot):
    await bot.add_cog(Status(bot))
