import { Character } from './models'
import DiscordClient from './services/discordClient'
const key = process.env.BOT_KEY

// const router = Character.router
// router.add('name', ['my name is :name', 'call me :name', 'i am :name', 'name\: :name'])
// router.add('age', ['i\'m :age years old', 'i\'ve been alive :age years', 'age\: :age'])
// console.log(router.process('my name is Justin Maier'))
// console.log(router.process('i was started by Justin'))
// console.log(router.process('my photo: http://test.com'))
// console.log(router.process('aka justo'))
// console.log(router.say({ name: 'Justin Maier', age: 31, created: new Date().toISOString(), creator: 'Heather' }))
// console.log(router.process('call me Justin Maier | age: 31 | i was born on 2020-04-09T20:37:31.319Z | i was birthed by Heather'))
// console.log(router.process('taco tiddly-winks! please!'))
// console.log(router.say({ response: 'taco tiddly-winks! please!' }))

class RandoBot extends DiscordClient {
  // constructor () {
  //   super()
  // }
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
