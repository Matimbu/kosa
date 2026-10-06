import { SlashCommandBuilder, PermissionFlagsBits } from 'discord.js';
import { joinVoiceChannel, getVoiceConnection, entersState, VoiceConnectionStatus } from '@discordjs/voice';
import { createEmbed } from '../../utils/embeds.js';
import { logger } from '../../utils/logger.js';
import { InteractionHelper } from '../../utils/interactionHelper.js';

export default {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join the voice channel you are in')
        .setDMPermission(false),

    async execute(interaction) {
        const deferSuccess = await InteractionHelper.safeDefer(interaction);
        if (!deferSuccess) return;

        const reply = (description, color) =>
            InteractionHelper.safeEditReply(interaction, {
                embeds: [createEmbed({ title: 'Join', description, color })],
            });

        const channel = interaction.member?.voice?.channel;
        if (!channel) {
            return reply('Join a voice channel first, then run `/join` again.', 'error');
        }

        const permissions = channel.permissionsFor(interaction.guild.members.me);
        if (!permissions?.has([PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect])) {
            return reply(
                `I can't see or connect to ${channel}. Give my role **View Channel** and **Connect** on that channel (or Administrator), then try again.`,
                'error',
            );
        }

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: interaction.guildId,
                adapterCreator: interaction.guild.voiceAdapterCreator,
                selfDeaf: true,
            });

            await entersState(connection, VoiceConnectionStatus.Ready, 15_000);
            return reply(`Joined ${channel}.`);
        } catch (error) {
            logger.error('Join command failed:', error);
            getVoiceConnection(interaction.guildId)?.destroy();
            return reply(`I couldn't connect to ${channel}. Check my permissions on that channel and try again.`, 'error');
        }
    },
};
