const { parseSnowflake } = require('../utils/parsers');

function normalizeLimit(value, fallback = 30) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.min(50, Math.max(10, Math.round(parsed)));
}

function isChatChannel(channel) {
  return channel && [0, 5].includes(Number(channel.type));
}

function buildPreview(content) {
  const text = String(content || '').replace(/\s+/g, ' ').trim();
  if (text.length <= 120) {
    return text;
  }
  return `${text.slice(0, 117).trim()}...`;
}

function createBotChatController({
  discordService,
  commandQueueService,
  logService,
  emitSystemUpdate
}) {
  return {
    async listMessages(req, res) {
      const channelId = parseSnowflake(req.query?.channel_id);
      if (!channelId) {
        res.status(400).json({ error: 'Choose a Discord text channel first.' });
        return;
      }

      try {
        const channels = await discordService.getChannels();
        const channel = channels.find((item) => String(item.id) === String(channelId));

        if (!isChatChannel(channel)) {
          res.status(400).json({ error: 'That channel is not available for bot chat.' });
          return;
        }

        const messages = await discordService.fetchChannelMessages(channelId, {
          limit: normalizeLimit(req.query?.limit)
        });

        res.json({
          channel_id: channelId,
          channel_name: channel.name,
          messages: [...messages].reverse()
        });
      } catch (error) {
        res.status(502).json({ error: error.message || 'Unable to load recent channel messages.' });
      }
    },

    async queueMessage(req, res) {
      const channelId = parseSnowflake(req.body?.channel_id);
      const replyToMessageId = parseSnowflake(req.body?.reply_to_message_id);
      const content = String(req.body?.content || '').replace(/\r\n/g, '\n').trim();

      if (!channelId) {
        res.status(400).json({ error: 'Choose a Discord text channel first.' });
        return;
      }

      if (!content) {
        res.status(400).json({ error: 'Type a message before sending through the bot.' });
        return;
      }

      if (content.length > 1800) {
        res.status(400).json({ error: 'Keep the bot message under 1800 characters.' });
        return;
      }

      try {
        const channels = await discordService.getChannels();
        const channel = channels.find((item) => String(item.id) === String(channelId));

        if (!isChatChannel(channel)) {
          res.status(400).json({ error: 'That channel is not available for bot chat.' });
          return;
        }

        const queued = commandQueueService.enqueueCommand('bot_chat_send', {
          channel_id: channelId,
          content,
          reply_to_message_id: replyToMessageId,
          actor_user_id: req.viewer?.id || null,
          actor_name: req.viewer?.display_name || 'Super Admin'
        });

        logService.appendLog(
          `Queued bot chat message for #${channel.name}.`,
          'info',
          'bot_chat',
          {
            channel_id: channelId,
            reply_to_message_id: replyToMessageId,
            actor_user_id: req.viewer?.id || null,
            preview: buildPreview(content)
          }
        );
        emitSystemUpdate('BOT_CHAT_QUEUED', {
          channel_id: channelId,
          reply_to_message_id: replyToMessageId,
          actor_user_id: req.viewer?.id || null,
          command_id: queued.id
        });

        res.json({
          success: true,
          command_id: queued.id
        });
      } catch (error) {
        res.status(502).json({ error: error.message || 'Unable to queue the bot message right now.' });
      }
    }
  };
}

module.exports = {
  createBotChatController
};
