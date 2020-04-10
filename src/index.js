import DiscordClient from './services/discordClient'
const key = process.env.BOT_KEY

class RandoBot extends DiscordClient {
  async command (message, cmd, args = []) {
    if (cmd === 'be') {
      // Character Creation
      const name = args.join(' ')
      const born = await message.guild.bots.birth(name, message.author)
      message.channel.send(born ? `${name} has been born!` : 'I can\'t do that')
    } else if (cmd === 'kill') {
      // Character Destruction
      const name = args.join(' ')
      const killed = await message.guild.bots.kill(name)
      message.channel.send(killed ? `I killed ${name}` : 'I can\'t do that')
    }
    super.command(message, cmd, args)
  }
}

const client = new RandoBot()
client.login(key)
