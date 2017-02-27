/*
  By: Mathurshan Vimalesvaran
  Last Modified: Feb 26th, 2017
*/

const FACTORY = 'FACTORY';
const TROOP = 'TROOP';
const MY_ENTITY = 1;
const ENEMY_ENTITY = -1;
const NEUTRAL_ENTITY = 0;

const distanceFrom = {}; // factoryA to factoryB

const factoryCount = parseInt(readline(), 10); // numb of factories (7 <= count <= 15)
const linkCount = parseInt(readline(), 10); // numb of links between factories (21 <= count <= 105)
for (let i = 0; i < linkCount; i++) {
  const inputs = readline().split(' ');
  const factory1 = parseInt(inputs[0], 10);
  const factory2 = parseInt(inputs[1], 10);
  const distance = parseInt(inputs[2], 10); // numb of turns needed to travel (1 <= distance <= 20)
  if (distanceFrom[factory1] == null) {
    distanceFrom[factory1] = {[factory2] : distance};
  } else {
    distanceFrom[factory1][factory2] = distance;
  }
}

function saveFactory(allFactories, myFactories, enemyFactories, id, owner, numCyborgs, prodRate) {
  allFactories[id] = {owner, numCyborgs, prodRate};
  if (owner === MY_ENTITY) {
    myFactories[id] = {numCyborgs, prodRate};
  } else if (owner === ENEMY_ENTITY) {
    enemyFactories[id] = {numCyborgs, prodRate};
  }
}

function saveTroop(troops, id, owner, fromFactory, targetFactory, numCyborgs, turnsLeftUntilArrival) {
  troops[id] = {owner, fromFactory, targetFactory, numCyborgs, turnsLeftUntilArrival};
}

function initTurn(entityCount, allFactories, myFactories, enemyFactories, troops) {
  for (let i = 0; i < entityCount; i++) {
    const inputs = readline().split(' ');
    const entityId = parseInt(inputs[0], 10);
    const entityType = inputs[1];

    if (entityType === FACTORY) {
      saveFactory(allFactories, myFactories, enemyFactories, entityId, parseInt(inputs[2], 10), parseInt(inputs[3], 10), parseInt(inputs[4], 10));
    } else if (entityType === TROOP) {
      saveTroop(troops, entityId, parseInt(inputs[2], 10), parseInt(inputs[3], 10), parseInt(inputs[4], 10), parseInt(inputs[5], 10), parseInt(inputs[6], 10));
    }
  }
}

function findNearbyEmptyFactory(allFactories, largestFactoryId) {
  // make sure factory is not mine
  // make sure factory is empty
  //  check mappings for < 10 turns from largestFactoryId
  let maxProd = 0;
  let bestFactory = null;
  // TODO: doesn't recognize factory ID 0
  // TODO: there has never been a factory that has a prod rate > 0 with no cyborgs on guard. I will need to change my tactic
  const nearbyFactories = Object.keys(distanceFrom[largestFactoryId]).filter((otherFactory) => distanceFrom[largestFactoryId][otherFactory] < 5);
  printErr('nearbyFactories:', nearbyFactories);
  for (let i = 0; i < nearbyFactories.length; i++) {
    const otherFactory = allFactories[nearbyFactories[i]];
    printErr('otherFactory:', json.stringify(otherFactory));
    if (otherFactory.owner !== MY_ENTITY &&
        otherFactory.numCyborgs === 0 &&
        otherFactory.prodRate > maxProd) {
      maxProd = otherFactory.prodRate;
      bestFactory = otherFactory;
    }
  }

  return bestFactory;
}

// game loop
while (true) {
  const allFactories = {};
  const myFactories = {};
  const enemyFactories = {};
  const troops = {};
  const entityCount = parseInt(readline(), 10); // numb of entities (factories and troops)
  initTurn(entityCount, allFactories, myFactories, enemyFactories, troops);

  // Write an action using print()
  // todo
  // get factory owned with the most cyborgs
  // {id : {numCyborgs : 1, prodRate : 1}}
  const largestFactoryId = Object.keys(myFactories).reduce((a, b) => {
    return myFactories[a].numCyborgs > myFactories[b].numCyborgs ? a : b;
  });

  printErr("largestFactoryId: ", largestFactoryId);
  const maybeBestFactory = findNearbyEmptyFactory(allFactories, largestFactoryId);
  printErr("maybeBestFactory: ", maybeBestFactory);

  // if empty factory nearby (< 10 turns away)
  //  check mappings for < 10 turns from largestFactoryId
  //  if it exists, find one with highest prodRate (must be > 0, if more than 1 exists, pick closest one)
  //  send 3 troop to it
  // else
  //  attack nearest weakest factory (troops + 1)
  // To debug: printErr('Debug messages...');


  // Any valid action, such as "WAIT" or "MOVE source destination cyborgs"
  print('WAIT');
}
