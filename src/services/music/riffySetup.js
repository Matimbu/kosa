import { createRequire } from 'module';
import { GatewayDispatchEvents } from 'discord.js';
import { logger } from '../../utils/logger.js';
import lavalinkConfig from '../../config/music/lavalink.js';
import { setupPlayerHandler } from './playerHandler.js';
const require = createRequire(import.meta.url);
const { Riffy } = require('riffy');

export function initializeMusic(client) {
    if (!lavalinkConfig.nodes?.length) {
        logger.error('No Lavalink nodes configured. Add lavalink/nodes.json, set LAVALINK_NODES, or set LAVALINK_HOST in your environment.');
        return;
    }
    client.riffy = new Riffy(client, lavalinkConfig.nodes, {
        send: (payload) => {
            const guild = client.guilds.cache.get(payload.d.guild_id);
            if (guild) {
                guild.shard.send(payload);
            }
        },
        defaultSearchPlatform: lavalinkConfig.defaultSearchPlatform,
        restVersion: lavalinkConfig.restVersion,
        bypassChecks: {
            nodeFetchInfo: true,
        },
    });
    setupPlayerHandler(client);

    client.on('raw', (packet) => {
        if (
            ![
                GatewayDispatchEvents.VoiceStateUpdate,
                GatewayDispatchEvents.VoiceServerUpdate,
            ].includes(packet.t)
        ) {
            return;
        }

        try {
            client.riffy.updateVoiceState(packet);
        } catch (error) {
            logger.warn(`Riffy voice state update failed (guild: ${packet.d?.guild_id ?? 'unknown'}): ${error.message}`);
            // A flaky/free Lavalink node can send an incomplete VOICE_SERVER_UPDATE.
            // Swallow it here instead of letting it crash the whole bot process.
        }
    });

    client.riffy.on('playerError', (player, error) => {
        logger.error(`Music player error in guild ${player.guildId}:`, error);
    });

    client.riffy.on('nodeDisconnect', (node) => {
        logger.warn(`Lavalink node "${node.name}" disconnected. Riffy will attempt to failover to another node if available.`);
    });

    client.riffy.on('nodeError', (node, error) => {
        logger.error(`Lavalink node "${node.name}" error: ${error.message}`);
    });

    client.riffy.on('nodeReconnect', (node) => {
        logger.info(`Lavalink node "${node.name}" reconnected.`);
    });

    logger.info(`Music initialized with ${lavalinkConfig.nodes.length} Lavalink node(s).`);
}

export function initRiffyAfterReady(client) {
    if (client.riffy && client.user?.id) {
        client.riffy.init(client.user.id);
        logger.info('Riffy voice connection manager initialized.');
    }
}
