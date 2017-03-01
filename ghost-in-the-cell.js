/*
  By: Mathurshan Vimalesvaran, Sean Deneen
  Last Modified: Feb 27th, 2017
*/

// TODO:
// revist from
// might need to defend a factory we already own

const FACTORY = 'FACTORY';
const TROOP = 'TROOP';
const MOVE = 'MOVE';
const WAIT = 'WAIT';
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
    const factoryId1 = parseInt(inputs[0], 10);
    const factoryId2 = parseInt(inputs[1], 10);
    const distance = parseInt(inputs[2], 10); // numb of turns needed to travel (1 <= distance <= 20)
    if (distanceFrom[factoryId1] == null) {
      distanceFrom[factoryId1] = {[factoryId2] : distance};
      distanceFrom[factoryId1][factoryId1] = 0;
    } else {
      distanceFrom[factoryId1][factoryId2] = distance;
    }
    if (distanceFrom[factoryId2] == null) {
      distanceFrom[factoryId2] = {[factoryId1] : distance};
      distanceFrom[factoryId2][factoryId2] = 0;
    } else {
      distanceFrom[factoryId2][factoryId1] = distance;
    }
  }
}

function playGame() {
  printErr('distanceFrom: ', JSON.stringify(distanceFrom));
  while (true) {
    let move = WAIT; // Default to WAIT if we can't choose a move

    const entityCount = parseInt(readline(), 10); // numb of entities (factories and troops)
    initTurn(entityCount);

    // get factory owned with the most cyborgs
    const largestFactoryId = Object.keys(myFactories).reduce((a, b) => {
      return myFactories[a].numCyborgs > myFactories[b].numCyborgs ? a : b;
    });

    if (myFactories[largestFactoryId].numCyborgs > 0) {

      printErr(`largestFactoryId: ${largestFactoryId}`);
      const factoryRatios = getFactoryRatios(largestFactoryId);

      printErr(`factoryRatios: ${factoryRatios}`);

      const bestFactoryId = chooseTargetFactory(largestFactoryId, factoryRatios);

      printErr(`bestFactoryId: ${bestFactoryId}`);


      if (bestFactoryId) {
        const numCyborgsToSend = calculateNumCyborgsToSend(largestFactoryId, bestFactoryId);
        printErr(`numCyborgsToSend: ${numCyborgsToSend}`);
        if (numCyborgsToSend <= myFactories[largestFactoryId].numCyborgs) {
          move = `${MOVE} ${largestFactoryId} ${bestFactoryId} ${calculateNumCyborgsToSend(largestFactoryId, bestFactoryId)}`;
        }
      }
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

function saveTroop(id, owner, fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival) {
  troops[id] = {owner, fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival};
}

// TODO this should take neutral vs enemy into account (enemy's factories will produce more cyborgs in the time we take to arrive)
// TODO should take into account any troops going toward the targetFactory (maybe should use calculateNumCyborgsToSend rather than targetFactory.numCyborgs
function getFactoryRatios(ourFactoryId) {
  const enemyAndNeutralFactories = Object.keys(allFactories).filter((f) => allFactories[f].owner !== MY_ENTITY);
  const factoryRatios = {};

  for (let i = 0; i < enemyAndNeutralFactories.length; i++) {
    const targetFactoryId = enemyAndNeutralFactories[i];
    const targetFactory = allFactories[targetFactoryId];
    factoryRatios[i] = targetFactory.prodRate / targetFactory.numCyborgs / distanceFrom[ourFactoryId][enemyAndNeutralFactories[i]];
  }

  return factoryRatios;
}

function chooseTargetFactory(fromFactoryId, factoryRatios) {
  printErr(`factoryRatios: ${factoryRatios}`);
  let bestFactoryId = null;
  while (bestFactoryId == null) {
    bestFactoryId = Object.keys(factoryRatios).reduce((a, b) => {
      return factoryRatios[a] > factoryRatios[b] ? a : b;
    });

    if (calculateNumCyborgsToSend(fromFactoryId, bestFactoryId) > myFactories[fromFactoryId].numCyborgs) {
      delete factoryRatios[bestFactoryId];
      bestFactoryId = null;
    }

    if (Object.keys(factoryRatios).length) {
      break;
    }
  }

  return bestFactoryId;
}

/**
 * @param fromFactoryId The id of the factory we are sending cyborgs from
 * @param targetFactoryId The id of the factory to send cyborgs to
 * @return {number} The number of cyborgs to send
 *
 * IMPLEMENTATION: (# of cyborgs defending the target factory + 1 + cushion)
 */
function calculateNumCyborgsToSend(fromFactoryId, targetFactoryId) {
  return allFactories[targetFactoryId].numCyborgs + 1 + calculateCushion(fromFactoryId, targetFactoryId);
}

/**
 *
 * @param ourFromFactoryId The id of the factory we are sending cyborgs from
 * @param targetFactoryId The the id of the factory to send cyborgs to
 * @returns {number} The number to cyborgs to act as our "cushion" to avoid being defeated by the opponent at the targetFactory
 *
 * IMPLEMENTATION: returns (distance from us / distance from their closest factory) rounded to nearest whole number
 * TODO should take into account any troops they are sending to the targetFactory
 * TODO maybe should also take into the account of the number of cyborgs they have at their factories. Their biggest threat may be farther away but have a lot more cyborgs. It would be only a fraction of their numCyborgs since they probably won't send all of them and leave their factory unguarded
 */
function calculateCushion(ourFromFactoryId, targetFactoryId) {
  const distanceFromUs = distanceFrom[ourFromFactoryId][targetFactoryId];

  // Figure out which of their factories is closest to targetFactory
  const enemyFromFactoryId = Object.keys(enemyFactories).reduce((a, b) => {
    return distanceFrom[a][targetFactoryId] < distanceFrom[b][targetFactoryId] ? a : b;
  });


  const distanceFromThem = distanceFrom[enemyFromFactoryId][targetFactoryId];
  return Math.round(distanceFromUs / distanceFromThem);
}

initGame();
playGame();

