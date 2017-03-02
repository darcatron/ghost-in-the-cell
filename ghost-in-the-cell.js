/*
  By: Mathurshan Vimalesvaran, Sean Deneen
  Last Modified: Feb 27th, 2017
*/

// TODO: (in order of what i think is most important - Matush)
// L:216 "TODO should take into account any troops they are sending to the targetFactory (seconded. saw situations where this made us make bad moves - Matush)"
// bombs - maybe use them as a retaliation? e.g. if they send a bomb, we'll send a bomb just to start
// might need to defend a factory we already own (look for any of their troops attacking a weak factory and send reinforcements)
// consider letting the enemy reduce the number of cyborgs at a neutral factory (may not work)


// BaseArmyPerFactory = prod rate * (current num cyborgs) / (dist from their closest factory)
    // TODO may want to incorporate: target factory's prod rate, num cyborgs that enemy has (atk vs def)

const FACTORY = 'FACTORY';
const TROOP = 'TROOP';
const MOVE = 'MOVE';
const WAIT = 'WAIT';
const MY_ENTITY = 1;
const ENEMY_ENTITY = -1;
const NEUTRAL_ENTITY = 0;

/* Coefficents */
const RDC = 5; // ratio distance - prioritize shorter distance from us when calculating the ratio
const MBASC = 0.1; // my base army size - reduce the rate at which the base army size increases

const distanceFrom = {}; // factoryA to factoryB

// changes by turn
let allFactories = {};
let myFactories = {};
let enemyFactories = {};
let allTroops = {};
let myTroops = {};
let enemyTroops = {};

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

    // TODO: revisit using just this as the value to caluclate ratios. my new multi move method looks at all factories when moving troops
    // get factory owned with the most cyborgs
    const largestFactoryId = Object.keys(myFactories).reduce((a, b) => {
      return myFactories[a].numCyborgs > myFactories[b].numCyborgs ? a : b;
    });

    if (myFactories[largestFactoryId].numCyborgs > 0) {

      printErr(`largestFactoryId: ${largestFactoryId}`);
      const factoryRatios = getFactoryRatios(largestFactoryId);

      printErr(`factoryRatios: ${JSON.stringify(factoryRatios)}`);

      const bestFactoryData = chooseTargetFactory(largestFactoryId, factoryRatios);

      printErr(`bestFactoryId: ${bestFactoryData.bestFactoryId}`);

      if (bestFactoryData.bestFactoryId) {
        let totalSent = 0;
        // get more moves while the total cyborgs to send isn't reached
        while (totalSent !== bestFactoryData.numCyborgsToSend) {
          const numCyborgsStillNeeded = bestFactoryData.numCyborgsToSend - totalSent;
          printErr(`numCyborgsStillNeeded: ${numCyborgsStillNeeded}`);
          // go through each of my spare cyborg factories and get the biggest spare
          let maxSpareCyborgs = 0;
          let maxSpareCyborgsIndex = -1;
          for (let i = 0; i < bestFactoryData.myFactoriesWithSpareCyborgs.length; i++) {
            const numSpareCyborgsAtFactory = parseInt(Object.keys(bestFactoryData.myFactoriesWithSpareCyborgs[i])[0]);
            if (numSpareCyborgsAtFactory > maxSpareCyborgs) {
              maxSpareCyborgs = numSpareCyborgsAtFactory;
              maxSpareCyborgsIndex = i;
            }
          }
          printErr(`bestFactoryData.myFactoriesWithSpareCyborgs[maxSpareCyborgsIndex]: ${JSON.stringify(bestFactoryData.myFactoriesWithSpareCyborgs[maxSpareCyborgsIndex])}`);
          if (maxSpareCyborgs > numCyborgsStillNeeded) {
            // add as many as neccesary to the move
            move = addToMove(move, bestFactoryData.myFactoriesWithSpareCyborgs[maxSpareCyborgsIndex][maxSpareCyborgs], bestFactoryData.bestFactoryId, numCyborgsStillNeeded);
            totalSent += numCyborgsStillNeeded; // essentially a break
          } else {
            move = addToMove(move, bestFactoryData.myFactoriesWithSpareCyborgs[maxSpareCyborgsIndex][maxSpareCyborgs], bestFactoryData.bestFactoryId, maxSpareCyborgs);
            totalSent += maxSpareCyborgs;
          }
          printErr(`totalSent: ${totalSent}`);
          // delete that factory from our array so we don't double count
          bestFactoryData.myFactoriesWithSpareCyborgs.splice(maxSpareCyborgsIndex, 1);
        }
      }
    }

    print(move);
    // To debug: printErr('Debug messages...');
  }
}

function addToMove(moveSoFar, fromFactoryId, targetFactoryId, numCyborgsToSend) {
  if (moveSoFar === WAIT) {
    moveSoFar = `${MOVE} ${fromFactoryId} ${targetFactoryId} ${numCyborgsToSend}`;
  } else {
    moveSoFar += `;${MOVE} ${fromFactoryId} ${targetFactoryId} ${numCyborgsToSend}`;
  }
  printErr(`moveSoFar: ${moveSoFar}`);
  return moveSoFar;
}

// PRECONDITION: myFactoryId has to be an id of a factory owned by MY_ENTITY
function getMyBaseArmySize(myFactoryId) {
  const closestFactoryId = findClosestFactoryId(enemyFactories, myFactoryId);
  // prod rate * (current number of our cyborgs) / (dist from their closest factory)
  printErr(`distanceFrom[closestFactoryId][myFactoryId]: ${distanceFrom[closestFactoryId][myFactoryId]}`);
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
    printErr('NEUTRAL ENTITY NOT ALLOWED IN GET NUM CYBORGS');
  }

  const numCyborgsInFactories = Object.keys(ownerFactories).map((id) => ownerFactories[id].numCyborgs).reduce((a, b) => a + b, 0);
  const numCyborgsInTroops = Object.keys(ownerTroops).map((id) => ownerTroops[id].numCyborgs).reduce((a, b) => a + b, 0);
  return numCyborgsInFactories + numCyborgsInTroops;
}

function initTurn(entityCount) {
  allFactories = {};
  myFactories = {};
  enemyFactories = {};
  allTroops = {};
  myTroops = {};
  enemyTroops = {};

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
// TODO this should use the average distance from each of our factories to the targetFactoryId instead of just the single largest factory (due to my multi MOVE change)
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
  // Don't leave fewer than myBaseArmySize behind at any of my factories
  const myFactoriesWithSpareCyborgs = Object.keys(myFactories).map((myFactoryId) => {
    const myBaseArmySize = getMyBaseArmySize(myFactoryId);
    const cyborgsAtFactory = myFactories[myFactoryId].numCyborgs;
    printErr(`My base army: ${myBaseArmySize}`);
    printErr(`cyborgsAtFactory: ${cyborgsAtFactory}`);

    if (cyborgsAtFactory > myBaseArmySize) {
      // mapping number of spare cyborgs to factoryId makes filtering easier
      // TODO what if two factories have the same number of spare cyborgs? -- Sean
      return {[cyborgsAtFactory - Math.round(myBaseArmySize)] : myFactoryId};
    }
  }).filter(obj => obj); // filters out null values
  printErr(`myFactoriesWithSpareCyborgs: ${JSON.stringify(myFactoriesWithSpareCyborgs)}`);

  const totalSpareCyborgs = myFactoriesWithSpareCyborgs.reduce((acc, val) => {
    // single mapping of spareCyborgs : myFactoryId
    return acc + parseInt(Object.keys(val)[0]);
  }, 0);
  printErr(`totalSpareCyborgs: ${totalSpareCyborgs}`);

  let bestFactoryId = null;
  let numCyborgsToSend = null;
  while (bestFactoryId == null) {
    bestFactoryId = Object.keys(factoryRatios).reduce((a, b) => {
      return factoryRatios[a] > factoryRatios[b] ? a : b;
    });

    // TODO this is a little wonky because we calculate the number of cyborgs to send based on fromFactoryId when we actually are considering all of our factories when calculating totalSpareCyborgs -- Sean
    numCyborgsToSend = calculateNumCyborgsToSend(fromFactoryId, bestFactoryId);
    printErr(`numCyborgsToSend: ${numCyborgsToSend}`);

    // if we don't have enough cyborgs total to spare, try next best target factory
    if (numCyborgsToSend > totalSpareCyborgs) {
      delete factoryRatios[bestFactoryId];
      bestFactoryId = null;
    }

    // TODO Shouldn't this only break if length is 0 since that means we are out of factories to try? -- Sean
    if (Object.keys(factoryRatios).length) {
      break;
    }
  }

  return {bestFactoryId, myFactoriesWithSpareCyborgs, numCyborgsToSend};
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
 * TODO should take into account any troops they are sending to the targetFactory (seconded. saw situations where this made us make bad moves -matush)
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

