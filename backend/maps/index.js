const forest     = require('./forest')
const desert     = require('./desert')
const castle     = require('./castle')
const industrial = require('./industrial')

const MAPS = {
  forest,
  desert,
  castle,
  industrial
}

function getMap(name) {
  return MAPS[name] || MAPS.forest
}

function getMapList() {
  return Object.keys(MAPS).map(k => ({
    id:   k,
    name: MAPS[k].name,
    desc: MAPS[k].description
  }))
}

module.exports = { MAPS, getMap, getMapList }