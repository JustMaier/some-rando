import Route from 'route-parser'
import sample from 'lodash/sample'
import isArray from 'lodash/isArray'

export class TextRoute extends Route {
  reverse (params) {
    return decodeURI(super.reverse(params))
  }
}

export default class ChatRouter {
  constructor (routes = {}, { delimiter = '|' } = {}) {
    this.delimiter = delimiter
    this.routes = {}
    Object.keys(routes).forEach(k => this.add(k, routes[k]))
  }

  add (property, routes) {
    if (!this.routes[property]) this.routes[property] = []

    // Add routes
    if (!isArray(routes)) routes = [routes]
    routes.forEach(route => {
      // Only add unique routes
      if (!this.routes[property].some(x => x.spec === route)) this.routes[property].push(new TextRoute(route.toLowerCase()))
    })

    return this
  }

  process (text) {
    const chunks = text.split(this.delimiter).map(x => x.trim())
    let params = null

    chunks.forEach(chunk => {
      let chunkParams = null

      for (const property in this.routes) {
        const routes = this.routes[property]
        for (const i in routes) {
          const route = routes[i]
          chunkParams = route.match(chunk)
          if (chunkParams) break
        }

        if (chunkParams) break
      }

      if (chunkParams) {
        if (!params) params = {}
        Object.assign(params, chunkParams)
      }
    })

    return params
  }

  say (properties) {
    const parts = []

    Object.keys(properties).forEach(property => {
      const routes = this.routes[property]
      if (!routes) return

      const route = sample(routes)
      parts.push(route.reverse({ [property]: properties[property] }))
    })

    return parts.length > 0 ? parts.join(` ${this.delimiter} `) : null
  }
}
