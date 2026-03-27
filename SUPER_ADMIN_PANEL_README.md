# Super Admin Panel README

This document is only about the SUPER_ADMIN layer of the IND Blades dashboard.
Other panels can be treated as stable working surfaces.
The main product focus from here is making the SUPER_ADMIN experience sharper, faster, and more powerful.

## Purpose

The SUPER_ADMIN panel is the highest-trust operating layer in the dashboard.
It is meant for the owner-level workflow where one person can:

- control the bot voice and bot identity
- manage the command structure of the website
- inspect every major system surface
- override normal operational friction
- act as the final safety and authority layer

## Access Model

- SUPER_ADMIN inherits every dashboard permission.
- SUPER_ADMIN also receives the private `manage_bot_chat` capability.
- The private bot chat route is `/dashboard/bot-chat`.
- The sidebar link for bot chat is only rendered when `manage_bot_chat` is present.
- The page itself redirects non-authorized viewers away even if they manually type the route.
- The server API also blocks non-authorized access, so the protection is not only visual.

## Current SUPER_ADMIN Feature Set

### 1. Dynamic Bot Brain Layer

The bot is no longer a static status line.
It now behaves more like a live control system.

Core behavior:

- rotates presence from real runtime data instead of one fixed label
- prioritizes critical moderation state before idle status
- tracks a live system tone by context
- publishes its live runtime state into the dashboard for SUPER_ADMIN visibility

Presence logic now reacts to:

- tracked member count
- active events
- active strikes
- current message traffic
- recent moderation actions
- recent event actions
- time of day

Current mode priorities:

- lockdown mode when strike pressure or recent moderation activity is high
- event mode when live events are active
- silent mode during quiet hours and low traffic
- traffic mode when chat volume is high
- daytime management mode during normal active hours
- idle fallback when nothing stronger is happening

What the SUPER_ADMIN can now see:

- current presence text
- current system tone
- active bot mode
- live messages-per-minute estimate
- active event count
- active strike count
- system identity line pushed from bot runtime

Why this matters:

- presence now acts like a small live status dashboard
- the bot identity feels deliberate instead of generic
- you can tell what state the bot is in without guessing

### 2. Private Bot Chat Control Room

Route: `/dashboard/bot-chat`

This is the current flagship SUPER_ADMIN-only tool.

Capabilities:

- select a text channel or announcement channel
- load a recent message feed directly from Discord
- click any recent message and reply as the bot
- send a fresh message as the bot without using your own Discord account
- trigger a real Discord typing indicator before the bot sends
- insert direct user mentions into the draft
- insert direct role mentions into the draft
- keep your own account out of the visible conversation
- work from a dedicated private route instead of mixing this into another panel

Operator value:

- lets you do controlled masti with friends while still looking like bot traffic
- gives you a fast "speaker system" for any allowed channel
- reduces friction when you need the bot to step in quickly
- keeps the control flow feeling like an admin console instead of a basic text box

### 3. Full Website Role Authority

The SUPER_ADMIN can control the website command chain.

Capabilities:

- assign leader
- assign deputy
- assign high command
- clear managed website roles
- view all member role state from the member directory
- retain final ownership over the chain of command

Why this matters:

- role control is the backbone of all higher dashboard permissions
- the SUPER_ADMIN is the only safe layer to centralize high-trust changes
- command structure changes can be handled without changing raw Discord server roles

### 4. Full Event Authority

The SUPER_ADMIN can use all event operations.

Capabilities:

- create events
- edit events
- enable or disable events
- delete events
- inspect attendance and decline reasons
- review routing, mention roles, and linked voice channels

Why this matters:

- SUPER_ADMIN can fully correct broken schedules
- no dependency on lower-role operators when urgent changes are needed
- event systems remain fully recoverable from one account

### 5. Full Welcome System Authority

Capabilities:

- enable or disable the welcome system
- change the welcome target channel
- edit the welcome title, body, media, and accent styling
- queue preview sends through the bot

Why this matters:

- welcome messaging affects first impressions and onboarding quality
- SUPER_ADMIN can own the exact presentation layer without touching code every time

### 6. Full Logging Authority

Capabilities:

- manage routed system logs
- manage Discord event logging categories
- assign destination channels for log categories
- inspect recent dashboard/system events

Why this matters:

- SUPER_ADMIN can keep audit visibility high
- log routing can be repaired quickly when a category or channel changes
- operational debugging stays inside the dashboard

### 7. Strike and Discipline Authority

Capabilities:

- issue strikes
- revoke strikes
- clear strike history
- review strike requests
- manage strike config
- monitor active strike counts across the roster

Why this matters:

- disciplinary systems need a final authority
- SUPER_ADMIN can fix broken or stale disciplinary state without waiting on another role

### 8. Activity and Automation Authority

Capabilities:

- review activity tracking
- reset activity data when needed
- manage autorole behavior
- manage related operational configuration

Why this matters:

- the SUPER_ADMIN can correct automation drift
- weekly reset and tracking systems stay under owner-level control

### 9. Global Visibility

The SUPER_ADMIN effectively has full dashboard visibility.

That includes:

- users
- events
- strikes
- welcome
- logs
- Discord logs
- activity
- notifications
- autorole settings
- management settings

Why this matters:

- one account can inspect the complete state of the product
- no blind spots remain when debugging a live issue

## Bot Chat Deep Dive

The bot chat console is currently the most important SUPER_ADMIN feature.

### Main flow

1. Open `/dashboard/bot-chat`.
2. Choose the destination channel.
3. Review the recent Discord feed.
4. Click `Reply as Bot` on any message, or write a fresh message.
5. Insert user or role mentions when needed.
6. Send through the bot.
7. Discord shows the typing state first.
8. The final visible sender is the bot account, not your own user.

### Current strengths

- fast enough for live banter
- safe enough to keep route access private
- flexible enough for replies and fresh messages
- polished enough to feel like an admin tool, not a debug endpoint
- backed by the same live bot-brain state used in Discord presence

### Manual Reply Principle

The bot does not auto-reply on its own anymore.

That means:

- no automatic replies on mention
- no automatic reactions
- no automatic identity or easter-egg responses
- no autonomous banter in channels

The only chat messages sent by the bot are now:

- fresh messages you queue from the SUPER_ADMIN bot chat panel
- replies you explicitly trigger from the SUPER_ADMIN bot chat panel

Why this is better for the current product:

- every visible bot message is authored by you
- no weak filler replies go out without your intent
- the bot identity stays under owner control
- the dashboard remains the single private command surface for bot chat

### Current guardrails

- route locked to SUPER_ADMIN capability
- API locked to SUPER_ADMIN capability
- user mentions allowed
- role mentions allowed
- `@everyone` and `@here` style blast behavior is intentionally blocked

### About Me / Bio note

Discord's bot bio/about-me field is not being changed by the bot code itself.
The runtime replacement in this project is the live identity/profile line shown in the dashboard and heartbeat data.

Current profile output includes:

- bot version
- monitored user count
- active event count
- active strike count

## SUPER_ADMIN-Only Product Focus

If future work is centered on the SUPER_ADMIN panel, these are the strongest upgrade paths:

- saved bot macros for repeat announcements
- per-channel bot persona presets
- direct member DM sending from the bot
- message scheduling and delayed sends
- message edit and delete controls for bot posts
- mention preview chips inside the composer
- audit history for bot-mask actions
- multi-channel watch mode
- priority alert board for leader/deputy actions
- one-screen command center for system status plus bot chat

## File Map For SUPER_ADMIN Work

- `client/src/pages/BotChatPage.jsx`
- `client/src/components/BotMastiPanel.jsx`
- `client/src/pages/OverviewPage.jsx`
- `client/src/hooks/useDashboard.js`
- `client/src/components/DashboardLayout.jsx`
- `server/src/controllers/systemController.js`
- `server/src/controllers/dashboardController.js`
- `server/src/controllers/botChatController.js`
- `server/src/routes/api.js`
- `server/src/constants/permissions.js`
- `server/src/services/discordService.js`
- `utils/system_identity.py`
- `cogs/status.py`
- `cogs/chat.py`

## Current Position

The SUPER_ADMIN layer already has:

- full operational authority
- private bot identity controls
- route-level privacy
- server-side permission enforcement
- command-chain control
- visibility across all major systems

This makes it a strong base for building a premium owner-grade admin surface next.
