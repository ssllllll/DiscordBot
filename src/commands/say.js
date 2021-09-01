const Command = require('../modules/commands/command');
const {
	Message, 
	MessageEmbed// eslint-disable-line no-unused-vars
} = require('discord.js');

module.exports = class SayCommand extends Command {

    constructor(client) {
		const i18n = client.i18n.getLocale(client.config.locale);
		super(client, {
			aliases: [

			],
			args: [
				{
					description: 'A command made only for staff members to say whatever they want via the bot',
					example: 'say Hello! Welcome to the x server',
					name: 'say',
					required: false
				}
			],
			description: 'A command made only for staff members to say whatever they want via the bot',
			internal: true,
			name: 'say',
			process_args: false
		});
	}

	/**
	 * @param {Message} message
	 * @param {string} args
     * @param {string} data.name
	 * @returns {Promise<void|any>}
	 */
	async execute(message, args) {

        const is_staff = message.member.roles.cache.some(role => role.name === '👑')

		if (!args) {
			await message.channel.send(
				new MessageEmbed()
			.setColor('ORANGE')
			.setTitle('⚠️')
			.setDescription('You didn\'t specify any message!')
			)
		}
		else {
		if (is_staff) {
			await message.delete();
			return await message.channel.send(args);
		}
	}
}
};