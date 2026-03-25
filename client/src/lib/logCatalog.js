export const LOG_GROUPS = [
  {
    label: 'Voice Logs',
    items: [
      { id: 'voice_join', label: 'User joins VC', description: 'Member joins a voice channel.' },
      { id: 'voice_leave', label: 'User leaves VC', description: 'Member leaves a voice channel.' },
      { id: 'voice_move', label: 'User moves VC', description: 'Member moves between voice channels.' },
      { id: 'voice_mute', label: 'Mute', description: 'Member mutes themselves.' },
      { id: 'voice_unmute', label: 'Unmute', description: 'Member unmutes themselves.' },
      { id: 'voice_deafen', label: 'Deafen', description: 'Member deafens themselves.' },
      { id: 'voice_undeafen', label: 'Undeafen', description: 'Member undeafens themselves.' },
      { id: 'voice_stream_start', label: 'Stream start', description: 'Member starts streaming.' },
      { id: 'voice_stream_stop', label: 'Stream stop', description: 'Member stops streaming.' },
    ],
  },
  {
    label: 'Message Logs',
    items: [
      { id: 'message_delete', label: 'Message deleted', description: 'A message is deleted.' },
      { id: 'message_edit', label: 'Message edited', description: 'A message is edited.' },
      { id: 'message_pin', label: 'Message pinned', description: 'A message gets pinned.' },
      { id: 'message_unpin', label: 'Message unpinned', description: 'A message gets unpinned.' },
    ],
  },
  {
    label: 'Moderation Logs',
    items: [
      { id: 'moderation_kick', label: 'Kick', description: 'A member is kicked.' },
      { id: 'moderation_ban', label: 'Ban', description: 'A member is banned.' },
      { id: 'moderation_unban', label: 'Unban', description: 'A member is unbanned.' },
      { id: 'moderation_timeout', label: 'Timeout', description: 'A member is timed out.' },
      { id: 'moderation_untimeout', label: 'Untimeout', description: 'A member timeout is removed.' },
    ],
  },
  {
    label: 'Member Logs',
    items: [
      { id: 'member_join', label: 'Member joined', description: 'A member joins the server.' },
      { id: 'member_leave', label: 'Member left', description: 'A member leaves the server.' },
    ],
  },
  {
    label: 'Role Logs',
    items: [
      { id: 'role_added', label: 'Role added', description: 'A role is added to a member.' },
      { id: 'role_removed', label: 'Role removed', description: 'A role is removed from a member.' },
      { id: 'role_updated', label: 'Role updated', description: 'A Discord role is edited.' },
    ],
  },
  {
    label: 'Channel Logs',
    items: [
      { id: 'channel_created', label: 'Channel created', description: 'A channel is created.' },
      { id: 'channel_deleted', label: 'Channel deleted', description: 'A channel is deleted.' },
      { id: 'channel_updated', label: 'Channel updated', description: 'A channel is edited.' },
    ],
  },
];

export const LOG_ITEMS = LOG_GROUPS.flatMap((group) =>
  group.items.map((item) => ({
    ...item,
    group: group.label,
  }))
);

const LOG_LABEL_MAP = new Map(LOG_ITEMS.map((item) => [item.id, item.label]));

export function getLogLabel(logId) {
  return LOG_LABEL_MAP.get(logId) || logId;
}

export function buildLogPickerItems() {
  return LOG_ITEMS.map((item) => ({
    id: item.id,
    label: item.label,
    description: `${item.group} - ${item.description}`,
  }));
}
