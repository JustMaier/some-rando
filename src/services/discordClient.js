import { Client } from 'discord.js'
import BotManager from './botManager'

export function isBotChannel (channel) {
  return channel.parent === channel.guild.botCategory
}

async function * messagesIterator (channel) {
  let before = null
  let done = false
  while (!done) {
    const messages = await channel.messages.fetch({ limit: 100, before })
    if (messages.size > 0) {
      before = messages.lastKey()
      yield messages
    } else done = true
  }
}

export async function * loadAllMessages (channel) {
  for await (const messages of messagesIterator(channel)) {
    for (const message of messages.values()) yield message
  }
}

export default class DiscordClient extends Client {
  constructor ({ botCategoryName = 'Characters' } = {}) {
    super()
    this.botCategoryName = botCategoryName

    this.on('ready', this.ready)

    this.on('message', this.message)
    this.on('messageUpdate', this.messageUpdate)
    this.on('messageDelete', this.messageDelete)

    this.on('messageReactionAdd', this.reactionAdd)
    this.on('messageReactionRemove', this.reactionRemove)

    this.on('guildCreate', this.guildCreate)
    this.on('guildDelete', this.guildDelete)

    this.on('channelCreate', this.channelCreate)
    this.on('channelDelete', this.channelDelete)
    this.on('channelUpdate', this.channelUpdate)
  }

  ready () {
    this.guilds.cache.forEach(g => this.guildConnected(g))
  }

  guildCreate (guild) {
    this.guildConnected(guild)
  }

  guildDelete (guild) {
    this.guildDisconnected(guild)
  }

  async guildConnected (guild) {
    console.log(`Connected: ${guild.name}`)

    // Add Bot Category if needed
    guild.botCategory = guild.channels.cache.find(x => x.name === this.botCategoryName)
    if (!guild.botCategory) guild.botCategory = await this.createBotCategory(guild)

    // Add Bots list
    guild.bots = new BotManager(guild)

    // Connect channels
    guild.channels.cache.forEach(this.channelCreate.bind(this))

    this.emit('guildConnected', guild)
  }

  guildDisconnected (guild) {
    console.log(`Disconnected: ${guild.name}`)
    this.emit('guildDisconnected', guild)
  }

  async channelCreate (channel) {
    if (isBotChannel(channel)) this.botChannelConnect(channel)
    else if (channel.type === 'text') this.loadWebhook(channel)
  }
  channelDelete (channel) {
    if (isBotChannel(channel)) this.botChannelDisconnect(channel)
  }
  channelUpdate (oldChannel, newChannel) {
    // if (isBotChannel(oldChannel) || isBotChannel(newChannel)) this.botChannelUpdate(oldChannel, newChannel)
  }
  async loadWebhook (channel) {
    const webhooks = await channel.fetchWebhooks()
    if (webhooks.size === 0) {
      channel.webhook = await channel.createWebhook(`Some Rando Bot`)
    } else {
      channel.webhook = webhooks.first()
    }
  }

  message (message) {
    if (message.author.bot) return

    // Handle Commands to Rando
    const isMentioned = message.content.startsWith(`<@!${this.user.id}>`)
    if (isMentioned) {
      const [cmd, ...args] = message.content.replace(`<@!${this.user.id}>`, '').trim().split(/ +/g)
      this.command(message, cmd, args)
    } else if (isBotChannel(message.channel)) { // Handle Commmands to Characters
      this.botMessage(message)
    } else {
      // Handle mentions of
      this.humanMessage(message)
    }
  }

  messageUpdate (oldMessage, newMessage) {
    if (newMessage.author.bot) return

    // Handle Commmands to Characters
    if (isBotChannel(newMessage.channel)) {
      this.botMessageDelete(oldMessage)
      this.botMessage(newMessage)
    }
  }

  messageDelete (message) {
    // Handle Commmands to Characters
    if (isBotChannel(message.channel)) {
      this.botMessageDelete(message)
    }
  }

  reactionAdd (reaction, user) {
    // Handle Commmands to Characters
    if (isBotChannel(reaction.message.channel)) {
      this.botReactionAdd(reaction, user)
    }
  }

  reactionRemove (reaction, user) {
    if (isBotChannel(reaction.message.channel)) {
      this.botReactionRemove(reaction, user)
    }
  }

  async command (message, cmd, args) {
    this.emit('command', message, cmd, args)
  }

  async createBotCategory (guild) {
    return guild.channels.create(this.botCategoryName, {
      type: 'category',
      topic: 'Home to all this server\'s fine characters'
    })
  }

  async botChannelConnect (channel) {
    channel.guild.bots.connect(channel)
    this.emit('botChannelConnect', channel)
  }

  async botChannelDisconnect (channel) {
    channel.guild.bots.disconnect(channel)
    this.emit('botChannelDisconnect', channel)
  }

  async botChannelUpdate (oldChannel, newChannel) {
    this.emit('botChannelUpdate', oldChannel, newChannel)
  }

  botMessage (message) {
    const bot = message.guild.bots.get(message.channel.id)
    if (bot) bot.processMessage(message)
    this.emit('botMessage', message)
  }

  botMessageDelete (message) {
    const bot = message.guild.bots.get(message.channel.id)
    if (bot) bot.deleteMessage(message)
    this.emit('botMessageDelete', message)
  }

  botReactionAdd (reaction, user) {
    const bot = reaction.message.guild.bots.get(reaction.message.channel.id)
    if (bot) bot.processReaction(reaction, user)
    this.emit('botReactionAdd', reaction, user)
  }

  botReactionRemove (reaction, user) {
    const bot = reaction.message.guild.bots.get(reaction.message.channel.id)
    if (bot) bot.deleteReaction(reaction, user)
    this.emit('botReactionRemove', reaction, user)
  }

  async humanMessage (message) {
    const bot = message.guild.bots.getMentioned(message)
    if (bot) bot.respond(message)
    this.emit('humanMessage', message)
  }
}
