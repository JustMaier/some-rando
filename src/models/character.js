import ChatRouter from '../services/chatRouter'
import isEqual from 'lodash/isEqual'
import sample from 'lodash/sample'
import { loadAllMessages } from '../services/discordClient'

const upvoteEmojis = ['🔼', '☝️', '👆', '🆙', '⬆', '👍', '⏫', '⬆️', '✔️', '☑️', '✅']
const isUpvote = (emoji) => upvoteEmojis.includes(emoji.name)
const downvoteEmojis = ['👇', '👎', '⬇', '🔽', '🔻', '⏬', '⬇️', '🔽', '❌']
const isDownvote = (emoji) => downvoteEmojis.includes(emoji.name)
const vote = upvoteEmojis.concat(downvoteEmojis)
const isVote = (emoji) => vote.includes(emoji.name)
const getVote = (emoji) => isUpvote(emoji) ? 1 : isDownvote(emoji) ? -1 : 0

class BotProperty {
  key
  value
  vote = 0

  constructor (message, key, value) {
    this.updateVote(message)
    this.key = key
    this.value = value
  }

  updateVote (message) {
    this.vote = message.reactions.cache.reduce((total, r) => total + getVote(r.emoji) * r.count, 0)
  }
}

export default class Character {
  name
  avatar
  aliases = []
  responses = []
  rawProperties = new Map()

  constructor (channel) {
    this.channel = channel
    const { name, avatar } = Character.router.process(this.channel.topic)
    this.name = name
    this.avatar = avatar

    this.load()
  }

  // #region lifecycle
  async load (before = null) {
    for await (const message of loadAllMessages(this.channel)) {
      this.processMessage(message)
    }
  }

  async destroy (deleteChannel = true) {
    if (deleteChannel) await this.channel.delete()
  }
  // #endregion

  // #region management
  propertyQueue = []
  updateTimeout = null
  async update (botProperty) {
    if (this.updateTimeout) clearTimeout(this.updateTimeout)
    this.propertyQueue.push(botProperty)
    this.updateTimeout = setTimeout(() => {
      const currentQueue = [...this.propertyQueue]
      this.propertyQueue.length = 0

      let updateBot = false

      // Update from properties
      Object.entries(Character.managedProperties).forEach(([key, options]) => {
        const matchKey = options.altKey || key
        const keyQueue = currentQueue.filter(x => x.key === matchKey)
        if (keyQueue.length === 0) return

        let changeMade = false

        // Working with limited quantity? then we have to get all props
        if (options.quantity) {
          const keyProperties = this.rawProperties.get(matchKey)
          if (!keyProperties) return

          // Order by best
          let values = [...keyProperties.values()]
          if (options.threshold) values = values.filter(x => x.vote > options.threshold)
          values = values.sort((a, b) => b.vote - a.vote).map(x => x.value)

          // Set the value
          const newValue = options.quantity === 1 ? values[0] : values.slice(0, options.quantity)
          if (!isEqual(this[key], newValue)) {
            changeMade = true
            this[key] = newValue
          }
        } else { // Add/Update queued items
          keyQueue.forEach(botProperty => {
            const existingIndex = this[key].indexOf(botProperty.value)

            const isBelowThreshold = options.threshold && options.threshold > 0 ? botProperty.vote < options.threshold : botProperty.vote <= options.threshold
            console.log(botProperty.value, botProperty.vote, options.threshold, isBelowThreshold)
            if (!isBelowThreshold && existingIndex === -1) {
              this[key].push(botProperty.value)
              changeMade = true
            } else if (existingIndex !== -1 && isBelowThreshold) {
              this[key].splice(existingIndex, 1)
              changeMade = true
            }
          })
        }

        if (changeMade) {
          if (options.updateBot) updateBot = true
        }
      })

      if (updateBot) {
        this.updateBotChannel()
      }

      this.updateTimeout = null
    }, 300)
  }

  async updateBotChannel () {
    return this.channel.edit({
      name: this.name,
      topic: Character.router.say({
        name: this.name,
        avatar: this.avatar
      })
    })
  }

  // #endregion

  // #region messages
  async processMessage (message) {
    // Append Attachment URLs
    const attachments = message.attachments.map(x => x.url)
    if (attachments.length > 0) {
      message.content += ' ' + attachments.join(' ')
    }

    const messageData = Character.router.process(message.content)
    Object.entries(messageData).forEach(([key, value]) => {
      const botProperty = new BotProperty(message, key, value)
      this.rawProperties.set(message.id, botProperty)

      if (!this.rawProperties.get(key)) this.rawProperties.set(key, new Map())
      this.rawProperties.get(key).set(message.id, botProperty)

      this.update(botProperty)
    })
  }

  async deleteMessage (message) {
    const botProperty = this.rawProperties.get(message.id)
    this.rawProperties.get(botProperty.key).delete(message.id)
    this.rawProperties.delete(message.id)
    console.log('deleted', message)

    this.update(botProperty)
  }

  async updateMessageVote (message) {
    const botProperty = this.rawProperties.get(message.id)
    botProperty.updateVote(message)

    this.update(botProperty)
  }
  // #endregion messages

  // #region reactions
  async processReaction (reaction, user) {
    console.log('added reaction', reaction.emoji.name)
    if (isVote(reaction.emoji)) this.updateMessageVote(reaction.message)
  }

  async deleteReaction (reaction) {
    console.log('deleted reaction', reaction.emoji.name)
    if (isVote(reaction.emoji)) this.updateMessageVote(reaction.message)
  }
  // #endregion

  // #region respond
  isMentioned (message) {
    const content = message.content.toLowerCase()

    for (const alias of [this.name, ...this.aliases]) {
      if (content.includes(alias.toLowerCase())) return true
    }

    return false
  }
  async sendImpersonated (channel, content, options = {}) {
    return channel.webhook.send(content, {
      username: this.name,
      avatarURL: this.avatar,
      ...options
    })
  }
  async respond (message) {
    const response = this.getResponse(message)
    return this.sendImpersonated(message.channel, response)
  }
  getResponse (message) {
    return sample(this.responses)
  }
  // #endregion
}

Character.managedProperties = {
  'name': { quantity: 1, channelName: true, updateBot: true },
  'aliases': { altKey: 'alias', quantity: null, threshold: 3 },
  'avatar': { quantity: 1, updateBot: true },
  'responses': { altKey: 'response', quantity: null, threshold: -2 }
}

Character.router = new ChatRouter()
  .add('name', ['my name is :name', 'call me :name', 'i am :name', 'name\: :name'])
  // .add('age', ['i\'m :age years old', 'i\'ve been alive :age years', 'age\: :age'])
  .add('alias', ['i respond to(\:) :alias', 'alias(\:) :alias', 'aka(\:) :alias'])
  .add('avatar', ['this is me(\:) *avatar', 'avatar(\:) *avatar', '(this is )(my )photo( is)(\:) *avatar'])
  // .add('creator', ['i was started by :creator', '(i was )made by :creator', '(i was )birthed by :creator'])
  // .add('created', ['i was born on :created', 'created(\:) :created'])
  .add('response', ['*response'])
