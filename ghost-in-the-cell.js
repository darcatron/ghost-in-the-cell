/*
  By: Mathurshan Vimalesvaran, Sean Deneen
  Last Modified: Feb 27th, 2017
*/

// TODO:
// L:216 "TODO should take into account any troops they are sending to the targetFactory (seconded. saw situations where this made us lose -matush)"
// might need to defend a factory we already own (look for any of their troops attacking a weak factory and send reinforcements)
// consider letting the enemy reduce the number of cyborgs at a neutral factory (may not work)
// number of cyborgs to send can be split into multiple factories (e.g. 3 factories we own can each send 3 cyborgs instead of 1 factory sending 9)

// Atk once we have BaseArmyPerFactory

// BaseArmyPerFactory = prod rate * (current num cyborgs) / (dist from their closest factory)
    // TODO may want to incorporate: target factory's prod rate, num cyborgs that enemy has (atk vs def)
// Never move away from factory if it will drop our numCyborgs below BaseArmyPerFactory

const FACTORY = 'FACTORY';
const TROOP = 'TROOP';
const MOVE = 'MOVE';
const WAIT = 'WAIT';
const MY_ENTITY = 1;
const ENEMY_ENTITY = -1;
const NEUTRAL_ENTITY = 0;

/* Coefficents */
const RDC = 5; // ratio distance - prioritize shorter distance from us when calculating the ratio
const MBASC = 0.2; // my base army size - reduce the rate at which the base army size increases

const distanceFrom = {}; // factoryA to factoryB
const allFactories = {};
const myFactories = {};
const enemyFactories = {};
const allTroops = {};
const myTroops = {};
const enemyTroops = {};

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

      printErr(`factoryRatios: ${JSON.stringify(factoryRatios)}`);

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

// PRECONDITION: myFactoryId has to be an id of a factory owned by MY_ENTITY
function getMyBaseArmySize(myFactoryId) {
  const closestFactoryId = findClosestFactoryId(enemyFactories, myFactoryId);
  // prod rate * (current number of our cyborgs) / (dist from their closest factory)
  return allFactories[myFactoryId].prodRate * getNumCyborgs(MY_ENTITY) * MBASC / distanceFrom[closestFactoryId][myFactoryId];
}

/**
 * @param owner Entity as defined at top (MY_ENTITY, ENEMY_ENTITY, etc)
 * @returns {number} The number of cyborgs owned by the given owner. Includes factories and troops
 */
function getNumCyborgs(owner) {
  let ownerFactories;
  let ownerTroops;

  if (owner === MY_ENTITY) {
    ownerFactories = myFactories;
    ownerTroops = myTroops;
  } else if (owner === ENEMY_ENTITY) {
    ownerFactories = enemyFactories;
    ownerTroops = enemyTroops;
  } else {
    printErr("NEUTRAL ENTITY NOT ALLOWED IN GET NUM CYBORGS");
  }

  const numCyborgsInFactories = Object.keys(ownerFactories).map((id) => ownerFactories[id].numCyborgs).reduce((a, b) => a + b, 0);
  const numCyborgsInTroops = Object.keys(ownerTroops).map((id) => ownerTroops[id].numCyborgs).reduce((a, b) => a + b, 0);
  return numCyborgsInFactories + numCyborgsInTroops;
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
  allTroops[id] = {owner, fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival};
  if (owner === MY_ENTITY) {
    myTroops[id] = {fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival};
  } else if (owner === ENEMY_ENTITY) {
    enemyTroops[id] = {fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival};
  }
}

// TODO this should take neutral vs enemy into account (enemy's factories will produce more cyborgs in the time we take to arrive)
// TODO should take into account any troops going toward the targetFactory (maybe should use calculateNumCyborgsToSend rather than targetFactory.numCyborgs
function getFactoryRatios(ourFactoryId) {
  const enemyAndNeutralFactoryIds = Object.keys(allFactories).filter((f) => allFactories[f].owner !== MY_ENTITY);
  const factoryRatios = {};

  for (let i = 0; i < enemyAndNeutralFactoryIds.length; i++) {
    const targetFactoryId = enemyAndNeutralFactoryIds[i];
    const targetFactory = allFactories[targetFactoryId];
    factoryRatios[targetFactoryId] = targetFactory.prodRate / (targetFactory.numCyborgs + 1) / (distanceFrom[ourFactoryId][targetFactoryId] * RDC);
    // printErr(`id: ${targetFactoryId} prod rate: ${targetFactory.prodRate}, num borgs: ${targetFactory.numCyborgs}, distance: ${distanceFrom[ourFactoryId][targetFactoryId]}`);
  }

  return factoryRatios;
}

function chooseTargetFactory(fromFactoryId, factoryRatios) {
  let bestFactoryId = null;
  while (bestFactoryId == null) {
    bestFactoryId = Object.keys(factoryRatios).reduce((a, b) => {
      return factoryRatios[a] > factoryRatios[b] ? a : b;
    });

    // Don't leave fewer than MyBaseArmySize behind at the fromFactory
    printErr(`My base army: ${getMyBaseArmySize(fromFactoryId)}`);
    printErr(`numCyborgsToSend: ${calculateNumCyborgsToSend(fromFactoryId, bestFactoryId)}`);
    if (calculateNumCyborgsToSend(fromFactoryId, bestFactoryId) + getMyBaseArmySize(fromFactoryId) > myFactories[fromFactoryId].numCyborgs) {
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
 * TODO should take into account any troops they are sending to the targetFactory (seconded. saw situations where this made us lose -matush)
 * TODO maybe should also take into the account of the number of cyborgs they have at their factories. Their biggest threat may be farther away but have a lot more cyborgs. It would be only a fraction of their numCyborgs since they probably won't send all of them and leave their factory unguarded
 */
function calculateCushion(ourFromFactoryId, targetFactoryId) {
  const distanceFromUs = distanceFrom[ourFromFactoryId][targetFactoryId];
  const enemyFromFactoryId = findClosestFactoryId(enemyFactories, targetFactoryId);
  const distanceFromThem = distanceFrom[enemyFromFactoryId][targetFactoryId];

  return Math.round(distanceFromUs / Math.max(distanceFromThem, 1));
}

// Figure out which of their factories is closest to factory given by factoryId
function findClosestFactoryId(factories, factoryId) {
  return Object.keys(factories).reduce((a, b) => {
    return distanceFrom[a][factoryId] < distanceFrom[b][factoryId] ? a : b;
  });
}

initGame();
playGame();

