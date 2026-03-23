import discord
from discord import app_commands
from discord.ext import commands, tasks
import time
from utils.storage import load_data, save_data, get_activity_config

def get_activity_data():
    data = load_data()
    return data.get("__activity__", {"users": {}, "last_reset": time.time()})

def save_activity_data(act_data):
    data = load_data()
    data["__activity__"] = act_data
    save_data(data)

def format_time(seconds):
    if seconds < 60:
        return f"{int(seconds)}s"
    minutes = seconds // 60
    if minutes < 60:
        return f"{int(minutes)}m"
    hours = minutes // 60
    remaining_minutes = minutes % 60
    return f"{int(hours)}h {int(remaining_minutes)}m"

class Activity(commands.Cog):
    def __init__(self, bot: commands.Bot):
        self.bot = bot
        self.active_voice = {}  # user_id: join_time
        self.check_weekly_reset.start()

    def cog_unload(self):
        self.check_weekly_reset.cancel()

    @tasks.loop(hours=1)
    async def check_weekly_reset(self):
        act_data = get_activity_data()
        elapsed = time.time() - act_data.get("last_reset", 0)
        # 7 days = 604800 seconds
        if elapsed >= 604800:
            act_data["users"] = {}
            act_data["last_reset"] = time.time()
            save_activity_data(act_data)

    @check_weekly_reset.before_loop
    async def before_reset(self):
        await self.bot.wait_until_ready()

    def _ensure_user(self, users, uid_str):
        if uid_str not in users:
            users[uid_str] = {"voice_time": 0, "messages": 0, "last_active": time.time()}

    @commands.Cog.listener()
    async def on_message(self, message: discord.Message):
        if message.author.bot or not message.guild:
            return
            
        act_data = get_activity_data()
        uid = str(message.author.id)
        self._ensure_user(act_data["users"], uid)
        
        act_data["users"][uid]["messages"] += 1
        act_data["users"][uid]["last_active"] = time.time()
        save_activity_data(act_data)

    @commands.Cog.listener()
    async def on_voice_state_update(self, member: discord.Member, before: discord.VoiceState, after: discord.VoiceState):
        if member.bot: return
            
        uid = member.id
        now = time.time()
        
        # Exclude AFK channel - use config or guild default
        config = get_activity_config()
        afk_id = config.get("afk_channel_id")
        if not afk_id and member.guild.afk_channel:
            afk_id = member.guild.afk_channel.id
        afk_id = int(afk_id) if afk_id else 0
        after_ch_id = getattr(after.channel, "id", 0) or 0
        # We define active state as not afk and not self_deaf
        is_valid_after = (after.channel is not None and 
                          not after.self_deaf and not after.deaf and 
                          after_ch_id != afk_id)
        
        # They left or changed to invalid state
        if uid in self.active_voice and (not is_valid_after or before.channel != after.channel):
            duration = now - self.active_voice[uid]
            del self.active_voice[uid]
            
            if duration > 0:
                act_data = get_activity_data()
                uid_str = str(uid)
                self._ensure_user(act_data["users"], uid_str)
                act_data["users"][uid_str]["voice_time"] += duration
                act_data["users"][uid_str]["last_active"] = now
                save_activity_data(act_data)

        # They joined or switched to a valid state
        if is_valid_after and uid not in self.active_voice:
            self.active_voice[uid] = now

    def _commit_pending_voice(self):
        now = time.time()
        act_data = get_activity_data()
        users = act_data.get("users", {})
        changed = False
        
        for uid, join_time in self.active_voice.items():
            duration = now - join_time
            uid_str = str(uid)
            self._ensure_user(users, uid_str)
            users[uid_str]["voice_time"] += duration
            self.active_voice[uid] = now # reset
            changed = True
            
        if changed:
            save_activity_data(act_data)
        return act_data

    def get_top_users(self, users, sort_key):
        sorted_users = sorted(users.items(), key=lambda x: x[1].get(sort_key, 0), reverse=True)
        return [(uid, data) for uid, data in sorted_users if data.get(sort_key, 0) > 0][:3]

    activity_group = app_commands.Group(name="activity", description="Activity tracking commands")

    @activity_group.command(name="stats", description="Show weekly activity leaderboard")
    async def cmd_stats(self, interaction: discord.Interaction):
        act_data = self._commit_pending_voice()
        users = act_data.get("users", {})

        for uid_str, data in users.items():
            # Voice is inherently weighted heavily in seconds vs raw message counts. 
            # E.g. 1 msg = 1 pt. 1 min of voice = 2 pts.
            data["score"] = (data.get("voice_time", 0) / 60) * 2 + data.get("messages", 0)

        top_voice = self.get_top_users(users, "voice_time")
        top_msgs = self.get_top_users(users, "messages")
        top_score = self.get_top_users(users, "score")

        def format_lb(lb_data, is_voice=False, is_score=False):
            if not lb_data: return "No data yet."
            lines = []
            medals = ["🥇", "🥈", "🥉"]
            for i, (uid, data) in enumerate(lb_data):
                val = format_time(data['voice_time']) if is_voice else (f"{int(data['score'])} pts" if is_score else f"{data['messages']} msgs")
                lines.append(f"{medals[i]} <@{uid}> → {val}")
            return "\n".join(lines)

        embed = discord.Embed(
            title="📊 IND Blades • Weekly Stats",
            description="Leaderboard for the current week.",
            color=0x2b2d31
        )
        
        embed.add_field(name="🎙️ Top Voice", value=format_lb(top_voice, is_voice=True), inline=False)
        embed.add_field(name="💬 Message Kings", value=format_lb(top_msgs), inline=False)
        embed.add_field(name="🏆 Top Contributors", value=format_lb(top_score, is_score=True), inline=False)
        
        embed.set_footer(text="IND Blades • Activity System")
        embed.timestamp = discord.utils.utcnow()

        await interaction.response.send_message(embed=embed)

    @activity_group.command(name="me", description="Show your personal activity stats")
    async def cmd_me(self, interaction: discord.Interaction):
        act_data = self._commit_pending_voice()
        users = act_data.get("users", {})
        
        uid_str = str(interaction.user.id)
        my_data = users.get(uid_str, {"voice_time": 0, "messages": 0})
        my_score = (my_data.get("voice_time", 0) / 60) * 2 + my_data.get("messages", 0)

        for u, d in users.items():
            d["score"] = (d.get("voice_time", 0) / 60) * 2 + d.get("messages", 0)
            
        sorted_users = sorted(users.items(), key=lambda x: x[1].get("score", 0), reverse=True)
        my_rank = "N/A"
        for i, (u, val) in enumerate(sorted_users):
            if u == uid_str:
                my_rank = f"#{i+1}"
                break

        embed = discord.Embed(
            title="👤 IND Blades • Personal Stats",
            description=f"Activity overview for {interaction.user.mention}",
            color=0x57F287
        )
        embed.add_field(name="General", value=f"**Global Rank:** {my_rank}\n**Total Score:** {int(my_score)} pts", inline=False)
        embed.add_field(name="Metrics", value=f"**Voice Time:** {format_time(my_data.get('voice_time', 0))}\n**Messages:** {my_data.get('messages', 0)}", inline=False)

        if interaction.user.avatar:
            embed.set_thumbnail(url=interaction.user.avatar.url)
        embed.set_footer(text="IND Blades • Activity System")
        embed.timestamp = discord.utils.utcnow()

        await interaction.response.send_message(embed=embed)

async def setup(bot: commands.Bot):
    await bot.add_cog(Activity(bot))
