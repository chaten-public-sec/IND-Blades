import json
import os

FILE_PATH = "data/reminders.json"


def load_data():
    if not os.path.exists(FILE_PATH):
        return {}
    with open(FILE_PATH, "r", encoding="utf-8") as file_handle:
        return json.load(file_handle)


def save_data(data):
    os.makedirs("data", exist_ok=True)
    with open(FILE_PATH, "w", encoding="utf-8") as file_handle:
        json.dump(data, file_handle, indent=4)


def get_meta(key, default=None):
    data = load_data()
    return data.get(key, default)


def get_log_settings():
    data = load_data()
    settings = data.get("__logs__", {})
    return {
        "enabled": bool(settings.get("enabled", True)),
        "moderation_channel_id": settings.get("moderation_channel_id"),
        "event_channel_id": settings.get("event_channel_id"),
        "system_channel_id": settings.get("system_channel_id"),
    }


def get_activity_config():
    data = load_data()
    c = data.get("__activity_config__", {})
    return {"afk_channel_id": c.get("afk_channel_id")}


def get_discord_log_settings():
    """New multi-category Discord logs. Bot uses this when __discord_logs__ exists."""
    data = load_data()
    dl = data.get("__discord_logs__", {})
    if not dl or not isinstance(dl.get("categories"), dict):
        return None
    return {
        "enabled": bool(dl.get("enabled", False)),
        "categories": {
            k: {
                "enabled": bool(v.get("enabled", False)),
                "channel_id": v.get("channel_id"),
            }
            for k, v in dl.get("categories", {}).items()
            if isinstance(v, dict)
        },
    }
