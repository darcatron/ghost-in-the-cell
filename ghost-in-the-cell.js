/*
  By: Mathurshan Vimalesvaran, Sean Deneen
  Last Modified: Feb 26th, 2017
*/

// TODO:
// revist from
// might need to defend a factory we already own

const FACTORY = 'FACTORY';
const TROOP = 'TROOP';
const MY_ENTITY = 1;
const ENEMY_ENTITY = -1;
const NEUTRAL_ENTITY = 0;

const distanceFrom = {}; // factoryA to factoryB
const allFactories = {};
const myFactories = {};
const enemyFactories = {};
const troops = {};

function initGame() {
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
    if (distanceFrom[factory2] == null) {
      distanceFrom[factory2] = {[factory1] : distance};
    } else {
      distanceFrom[factory2][factory1] = distance;
    }
  }
}

function playGame() {
  while (true) {
    const entityCount = parseInt(readline(), 10); // numb of entities (factories and troops)
    initTurn(entityCount);

    // get factory owned with the most cyborgs
    // {id : {numCyborgs : 1, prodRate : 1}}
    const largestFactoryId = Object.keys(myFactories).reduce((a, b) => {
      return myFactories[a].numCyborgs > myFactories[b].numCyborgs ? a : b;
    });
    printErr('largestFactoryId: ', largestFactoryId);

    const factoryRatios = getFactoryRatios(largestFactoryId);

    printErr('factoryRatios: ', factoryRatios);

    const bestFactory = chooseTargetFactory(largestFactoryId, factoryRatios);

    let move = 'WAIT';
    if (bestFactory) {
      move = `MOVE ${largestFactoryId} ${bestFactory} ${calculateNumCyborgsToSend(largestFactoryId, bestFactory)}`;
    }

    print(move);
    // To debug: printErr('Debug messages...');
  }
}

function initTurn(entityCount) {
  for (let i = 0; i < entityCount; i++) {
    const inputs = readline().split(' ');
    const entityId = parseInt(inputs[0], 10);
    const entityType = inputs[1];

    if (entityType === FACTORY) {
      saveFactory(entityId, parseInt(inputs[2], 10), parseInt(inputs[3], 10), parseInt(inputs[4], 10));
    } else if (entityType === TROOP) {
      saveTroop(entityId, parseInt(inputs[2], 10), parseInt(inputs[3], 10), parseInt(inputs[4], 10), parseInt(inputs[5], 10), parseInt(inputs[6], 10));
    }
  }
}

function saveFactory(id, owner, numCyborgs, prodRate) {
  allFactories[id] = {owner, numCyborgs, prodRate};
  if (owner === MY_ENTITY) {
    myFactories[id] = {numCyborgs, prodRate};
  } else if (owner === ENEMY_ENTITY) {
    enemyFactories[id] = {numCyborgs, prodRate};
  }
}

function saveTroop(id, owner, fromFactory, targetFactory, numCyborgs, turnsLeftUntilArrival) {
  troops[id] = {owner, fromFactory, targetFactory, numCyborgs, turnsLeftUntilArrival};
}

function getFactoryRatios(ourFactory) {
  const enemyAndNeutralFactories = Object.keys(allFactories).filter((f) => allFactories[f].owner !== MY_ENTITY);
  printErr('enemyAndNeutralFactories:', enemyAndNeutralFactories);
  const factoryRatios = {};

  for (let i = 0; i < enemyAndNeutralFactories.length; i++) {
    const targetFactory = allFactories[enemyAndNeutralFactories[i]];
    factoryRatios[i] = targetFactory.prodRate / targetFactory.numCyborgs / distanceFrom[ourFactory][targetFactory];
  }

  return factoryRatios;
}

function chooseTargetFactory(fromFactory, factoryRatios) {
  let bestFactory = null;
  while (bestFactory == null) {
    bestFactory = Object.keys(factoryRatios).reduce((a, b) => {
      return factoryRatios[a] > factoryRatios[b] ? a : b;
    });

    if (calculateNumCyborgsToSend(fromFactory, bestFactory) > myFactories[fromFactory].numCyborgs) {
      delete factoryRatios[bestFactory];
      bestFactory = null;
    }

    if (Object.keys(factoryRatios).length) {
      break;
    }
  }

  return bestFactory;
}

/**
 * @param fromFactory The factory we are sending cyborgs from
 * @param targetFactory The factory to send cyborgs to
 * @return {number} The number of cyborgs to send
 *
 * IMPLEMENTATION: (# of cyborgs defending the target factory + 1 + cushion)
 */
function calculateNumCyborgsToSend(fromFactory, targetFactory) {
  return allFactories[targetFactory].numCyborgs + 1 + calculateCushion(fromFactory, targetFactory);
}

/**
 *
 * @param ourFromFactory The factory we are sending cyborgs from
 * @param targetFactory The factory to send cyborgs to
 * @returns {number} The number to cyborgs to act as our "cushion" to avoid being defeated by the opponent at the targetFactory
 *
 * IMPLEMENTATION: returns (distance from us / distance from their closest factory) rounded to nearest whole number
 * TODO should also take into the account of the number of cyborgs they have at their factories. Their biggest threat may be farther away but have a lot more cyborgs
 */
function calculateCushion(ourFromFactory, targetFactory) {
  const distanceFromUs = distanceFrom[ourFromFactory][targetFactory];

  // Figure out which of their factories is closest to targetFactory
  const enemyFromFactory = Object.keys(enemyFactories).reduce((a, b) => {
    return distanceFrom[a][targetFactory] > distanceFrom[b][targetFactory] ? a : b;
  });

  const distanceFromThem = distanceFrom[enemyFromFactory][targetFactory];
  printErr('distanceFromThem: ', distanceFromThem);

  return Math.round(distanceFromUs / distanceFromThem);
}

initGame();
playGame();
