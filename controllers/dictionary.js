'use strict'

const bot = require('../core/telegram')
const config = require('../data/config.json')
const request = require('request')
const utils = require('../core/utils')

function getDescription (msg, word, source, target) {
  const lang = utils.getUserLang(msg)
  let url = 'https://od-api.oxforddictionaries.com/api/v1/entries/'
  const input = encodeURIComponent(word)

  if (source && target) {
    url = url + source + '/' + input + '/translations=' + target
  } else {
    url = 'https://od-api.oxforddictionaries.com/api/v1/entries/' + 'en/' + input
  }

  request({
    uri: url,
    headers: {
      'app_id': config.oxford.ID,
      'app_key': config.oxford.KEY
    }
  }, (error, response, body) => {
    if (error) {
      return console.log(error)
    }

    switch (response.statusCode) {
      case 404:
        bot.sendMessage(msg.chat.id, `${lang.dictionary.dlg[0]} "${word}"`, utils.optionalParams(msg))
        return
        // break
      case 500:
        bot.sendMessage(msg.chat.id, `${lang.dictionary.dlg[1]}`, utils.optionalParams(msg))
        return
        // break
    }

    const oxdat = JSON.parse(body)
    const title = utils.escapeHtml(oxdat.results[0].word)
    let results = oxdat.results[0].lexicalEntries
    let oxford = []
    const max = (results.length > 4) ? 4 : results.length

    if (source && target) {
      for (let i = 0; i < max; i++) {
        let trans = results[i].entries[0].senses
        for (let n = 0; n < trans.length; n++) {
          if (trans[n].translations) {
            oxford.push(trans[n].translations[0].text)
          }
        }
      }
      oxford = '<i>' + utils.escapeHtml(oxford.join(', ')) + '</i>'
    } else {
      if (results[0].derivativeOf) {
        const derivative = results[0].derivativeOf[0].text
        oxford.push(`➜ ${lang.dictionary.dlg[2]} <a href="https://en.oxforddictionaries.com/definition/${derivative}">${derivative}</a>`)
      } else {
        for (let i = 0; i < max; i++) {
          let sense = oxdat.results[0].lexicalEntries[i].entries[0].senses[0]
          if (sense.definitions) {
            oxford.push('• ' + sense.definitions[0])
          } else {
            oxford.push('• ' + sense.crossReferences[0].text)
          }
        }
      }
      oxford = oxford.join('\n')
    }
    oxford = (results.length === 1) ? oxford.replace(/^• /, '') : oxford
    bot.sendMessage(msg.chat.id, '<b>' + title + '</b>\n' + oxford, utils.optionalParams(msg))
  })
}

bot.onText(/^[/!#](d|dict|dictionary) (.+)/, (msg, match) => {
  getDescription(msg, `${match[2]}`.toLowerCase())
})

bot.onText(/^[/!#](t|trans|translate) (en|es|ro|ms|id)-(en|es|ro|ms|id) (.+)/, (msg, match) => {
  // https://developer.oxforddictionaries.com/documentation/languages
  const source = `${match[2]}`
  const target = `${match[3]}`

  if (source !== target) getDescription(msg, `${match[4]}`.toLowerCase(), source, target)
})
