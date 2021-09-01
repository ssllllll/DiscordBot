const Command = require('../modules/commands/command');
const {
	Message, // eslint-disable-line no-unused-vars
	MessageEmbed
} = require('discord.js');
const { footer } = require('../utils/discord');
const { letters } = require('../utils/emoji');
const { wait } = require('../utils');

module.exports = class NewCommand extends Command {
	constructor(client) {
		const i18n = client.i18n.getLocale(client.config.locale);
		super(client, {
			aliases: [
				i18n('commands.new.aliases.create'),
				i18n('commands.new.aliases.open'),
				i18n('commands.new.aliases.ticket')
			],
			args: [
				{
					description: i18n('commands.new.args.topic.description'),
					example: i18n('commands.new.args.topic.example'),
					name: i18n('commands.new.args.topic.name'),
					required: false
				}
			],
			description: i18n('commands.new.description'),
			internal: true,
			name: i18n('commands.new.name'),
			process_args: false
		});
	}

	/**
	 * @param {Message} message
	 * @param {string} args
	 * @returns {Promise<void|any>}
	 */
	async execute(message, args) {
		const settings = await message.guild.getSettings();
		const i18n = this.client.i18n.getLocale(settings.locale);

		const editOrSend = async (msg, content) => {
			if (msg) return await msg.edit(content);
			else return await message.channel.send(content);
		};

		const create = async (cat_row, response) => {
			const tickets = await this.client.db.models.Ticket.findAndCountAll({
				where: {
					category: cat_row.id,
					creator: message.author.id,
					open: true
				}
			});

			if (tickets.count >= cat_row.max_per_member) {
				if (cat_row.max_per_member === 1) {
					response = await editOrSend(response,
						new MessageEmbed()
							.setColor(settings.error_colour)
							.setAuthor(message.author.username, message.author.displayAvatarURL())
							.setTitle(i18n('commands.new.response.has_a_ticket.title'))
							.setDescription(i18n('commands.new.response.has_a_ticket.description', tickets.rows[0].id))
							.setFooter(footer(settings.footer, i18n('message_will_be_deleted_in', 15)), message.guild.iconURL())
					);
				} else {
					const list = tickets.rows.map(row => {
						if (row.topic) {
							const description = row.topic.substring(0, 30);
							const ellipses = row.topic.length > 30 ? '...' : '';
							return `<#${row.id}>: \`${description}${ellipses}\``;
						} else {
							return `<#${row.id}>`;
						}
					});
					response = await editOrSend(response,
						new MessageEmbed()
							.setColor(settings.error_colour)
							.setAuthor(message.author.username, message.author.displayAvatarURL())
							.setTitle(i18n('commands.new.response.max_tickets.title', tickets.count))
							.setDescription(i18n('commands.new.response.max_tickets.description', settings.command_prefix, list.join('\n')))
							.setFooter(footer(settings.footer, i18n('message_will_be_deleted_in', 15)), message.guild.iconURL())
					);
				}
			} else {
				try {
					const t_row = await this.client.tickets.create(message.guild.id, message.author.id, cat_row.id, args);
					response = await editOrSend(response,
						new MessageEmbed()
							.setColor(settings.success_colour)
							.setAuthor(message.author.username, message.author.displayAvatarURL())
							.setTitle(i18n('commands.new.response.created.title'))
							.setDescription(i18n('commands.new.response.created.description', `<#${t_row.id}>`))
							.setFooter(footer(settings.footer, i18n('message_will_be_deleted_in', 15)), message.guild.iconURL())
					);
				} catch (error) {
					response = await editOrSend(response,
						new MessageEmbed()
							.setColor(settings.error_colour)
							.setAuthor(message.author.username, message.author.displayAvatarURL())
							.setTitle(i18n('commands.new.response.error.title'))
							.setDescription(error.message)
							.setFooter(footer(settings.footer, i18n('message_will_be_deleted_in', 15)), message.guild.iconURL())
					);
				}
			}

			setTimeout(async () => {
				await response
					.delete()
					.catch(() => this.client.log.warn('Failed to delete response message'));
				await message
					.delete()
					.catch(() => this.client.log.warn('Failed to delete original message'));
			}, 15000);
		};

		const categories = await this.client.db.models.Category.findAndCountAll({ where: { guild: message.guild.id } });

		if (categories.count === 0) {
			return await message.channel.send(
				new MessageEmbed()
					.setColor(settings.error_colour)
					.setAuthor(message.author.username, message.author.displayAvatarURL())
					.setTitle(i18n('commands.new.response.no_categories.title'))
					.setDescription(i18n('commands.new.response.no_categories.description'))
					.setFooter(settings.footer, message.guild.iconURL())
			);
		} else if (categories.count === 1) {
			create(categories.rows[0]); // skip the category selection
		} else {
			const letters_array = Object.values(letters); // convert the A-Z emoji object to an array
			const category_list = categories.rows.map((category, i) => `${letters_array[i]} » ${category.name}`); // list category names with an A-Z emoji
			const collector_message = await message.channel.send(
				new MessageEmbed()
					.setColor(settings.colour)
					.setAuthor(message.author.username, message.author.displayAvatarURL())
					.setTitle(i18n('commands.new.response.select_category.title'))
					.setDescription(i18n('commands.new.response.select_category.description', category_list.join('\n')))
					.setFooter(footer(settings.footer, i18n('collector_expires_in', 30)), message.guild.iconURL())
			);

			for (const i in categories.rows) {
				collector_message.react(letters_array[i]); // add the correct number of letter reactions
				await wait(1000); // 1 reaction per second rate-limit
			}

			const collector_filter = (reaction, user) => {
				const allowed = letters_array.slice(0, categories.count); // get the first x letters of the emoji array
				return user.id === message.author.id && allowed.includes(reaction.emoji.name);
			};

			const collector = collector_message.createReactionCollector(collector_filter, { time: 30000 });

			collector.on('collect', async reaction => {
				collector.stop();
				const index = letters_array.findIndex(value => value === reaction.emoji.name); // find where the letter is in the alphabet
				if (index === -1) {
					return setTimeout(async () => {
						await collector_message.delete();
					}, 15000);
				}
				await collector_message.reactions.removeAll();
				create(categories.rows[index], collector_message); // create the ticket, passing the existing response message to be edited instead of creating a new one
			});

			collector.on('end', async collected => {
				if (collected.size === 0) {
					await collector_message.reactions.removeAll();
					await collector_message.edit(
						new MessageEmbed()
							.setColor(settings.error_colour)
							.setAuthor(message.author.username, message.author.displayAvatarURL())
							.setTitle(i18n('commands.new.response.select_category_timeout.title'))
							.setDescription(i18n('commands.new.response.select_category_timeout.description'))
							.setFooter(footer(settings.footer, i18n('message_will_be_deleted_in', 15)), message.guild.iconURL())
					);
					setTimeout(async () => {
						await collector_message
							.delete()
							.catch(() => this.client.log.warn('Failed to delete response (collector) message'));
						await message
							.delete()
							.catch(() => this.client.log.warn('Failed to delete original message'));
					}, 15000);
				}
			});
		}
	}
};
