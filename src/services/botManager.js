import Collection from '@discordjs/collection'
import { Character } from '../models'

export default class BotManager extends Collection {
  guild

  constructor (guild) {
    super()
    this.guild = guild
  }

  // #region lifecyle
  async connect (channel) {
    const character = new Character(channel)
    this.set(channel.id, character)
  }

  async disconnect (channel) {
    const character = this.get(channel.id)
    if (character) await character.destroy(false)
    this.delete(channel.id)
  }
  // #endregion

  // #region commands
  async birth (name, creator) {
    // Prevent name sharing
    name = name.toLowerCase()
    if (this.find(x => x.name.toLowerCase() === name)) return false

    const channel = await this.guild.channels.create(name, {
      topic: Character.router.say({ name }),
      reason: Character.router.say({ creator: creator.name, created: new Date().toISOString() }),
      parent: this.guild.botCategory
    })

    channel.send(Character.router.say({ name }))

    return true
  }

  async kill (name) {
    name = name.toLowerCase()
    const bot = this.find(x => x.name.toLowerCase() === name)
    if (bot) {
      await bot.destroy()
      return true
    } else return false
  }
  // #endregion

  // #region handling

  getMentioned (message) {
    for (const bot of this.values()) {
      if (bot.isMentioned(message)) return bot
    }

    return null
  }

  // #endregion
}
