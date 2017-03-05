/*
  By: Mathurshan Vimalesvaran, Sean Deneen
  Last Modified: Mar 2nd, 2017
*/

// TODO:
// might need to defend a factory we already own (look for any of their troops attacking a weak factory and send reinforcements) <--- Escalated to top by Sean
// Bomb Strategy
  // early on destroy their 3 and take it over
  // maybe use them as a retaliation? e.g. if they send a bomb, we'll send a bomb just to start
  // if the enemy throws bomb, determine where it's likely to go and distribute troops and send reinforcements/swap troops (HIGH PRIORITY as well)
// Factory upgrade strategy
  // valuable for prodRate=0 factories
    // if it's far away from enemies
    // if it's close to lots of our factories
    // if we have 10 + (estimated baseArmySize for a prodRate=0 factory assuming it has a prodRate=1) spare troops
      // move the spare troops there and level up that factory
      // maybe do this if we finish all of our moves but still have 10+ spare at a single factory?
// Multiple moves
  // if we have more troops to spare after our hitting our best target factory, we should target another factory

// BONUS: (visit if we have time)
// consider letting the enemy reduce the number of cyborgs at a neutral factory (may not work)

const FACTORY = 'FACTORY';
const TROOP = 'TROOP';
const BOMB = 'BOMB';
const MOVE = 'MOVE';
const WAIT = 'WAIT';
const MY_ENTITY = 1;
const ENEMY_ENTITY = -1;
const NEUTRAL_ENTITY = 0;

/* Coefficents */
const RDC = 5; // ratio distance - prioritize shorter distance from us when calculating the ratio
const MBASC = 0.1; // my base army size - reduce the rate at which the base army size increases

const distanceFrom = {}; // factoryA to factoryB
const MAX_PROD_RATE = 3;
const MIN_CYBORGS_DESTROYED_BY_BOMB = 10;

// changes by turn
let retaliatedOnThatBish = false;
let sentInitialBomb = false;

let allFactories = {};
let factoriesByOwner = {};
let bombsByOwner = {};
let troopsByOwner = {};

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

    const myFactories = factoriesByOwner[MY_ENTITY];
    if (Object.keys(myFactories).length === 0) {
      // Have to wait if we have no factories
      print(WAIT);
      continue;
    }

    const myFactoriesWithSpareCyborgs = getMyFactoriesWithSpareCyborgs(myFactories);
    const totalNumSpareCyborgs = getTotalSpareCyborgs(myFactoriesWithSpareCyborgs);

    // TODO: revisit using just this as the value to caluclate ratios. my new multi move method looks at all factories when moving troops
    // get factory owned with the most cyborgs
    const fromFactoryId = Object.keys(myFactories).reduce((a, b) => {
      return myFactories[a].numCyborgs > myFactories[b].numCyborgs ? a : b;
    });

    if (myFactories[fromFactoryId].numCyborgs > 0) {
      // MATUSH TODAY - 5
      // PROPOSED PSEUDOCODE FOR MULTI ACTION STRATEGY
        // while totalNumSpareCyborgs > 0 and ratios.length > 0
          // choose target factory based on ratios that replace distance between fromFactory and targetFactory with the average closeness to our spare cyborgs
          // For each factory with spare cyborgs (fromFactory)
            // get num cyborgs to send to target factory
            // if num cyborgs to send < totalNumSpareCyborgs
              // Add move between fromFactory and targetFactory
              // Decrement myFactoriesWithSpareCyborgs as appropriate
              // Recalculate totalNumSpareCyborgs
            // else
              // Remove target factory from ratios
      printErr(`fromFactoryId: ${fromFactoryId}`);
      const factoryRatios = getFactoryRatios(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs);

      printErr(`factoryRatios: ${JSON.stringify(factoryRatios)}`);

      // MATUSH TODAY - 2
      // TODO
      // while (targetFactoryId !== null) {
      //   getTroopMoves()
      //   targetFactoryId = getTargetFactoryId()
      // }
      const targetFactoryId = getTargetFactoryId(myFactoriesWithSpareCyborgs, factoryRatios, totalNumSpareCyborgs);

      printErr(`targetFactoryId: ${targetFactoryId}`);
      printErr(`myFactoriesWithSpareCyborgs: ${JSON.stringify(myFactoriesWithSpareCyborgs)}`);

      if (targetFactoryId) {
        move = getTroopMoves(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs, targetFactoryId, move);
        printErr(`move so far: ${move}`);
      }
    }
    const maybeBombMove = bombStrategy();
    if (maybeBombMove) {
      printErr(`sending bomb move: ${maybeBombMove}`);
      move = addToMove(move, null, null, null, maybeBombMove);
    }

    print(move);
    // To debug: printErr('Debug messages...');
  }
}

function getSpareFactoryWeightedDistance(spareFactories, totalSpareCyborgs, targetFactoryId) {
  return Object.keys(spareFactories).reduce((acc, spareFactoryId) => {
    const weight = spareFactories[spareFactoryId] / totalSpareCyborgs;
    return acc + (distanceFrom[spareFactoryId][targetFactoryId] * weight);
  }, 0);
}

function getTroopMoves(myFactoriesWithSpareCyborgs, totalSpareCyborgs, targetFactoryId, move) {
  // MATUSH TODAY - 5
    // this should already be known from before
  const weightedDistance = getSpareFactoryWeightedDistance(myFactoriesWithSpareCyborgs, totalSpareCyborgs, targetFactoryId);
  const numCyborgsToSend = calculateNumCyborgsToSend(weightedDistance, targetFactoryId);
  let totalSent = 0;
  // get more moves while the total cyborgs to send isn't reached
  while (totalSent !== numCyborgsToSend) {
    const numCyborgsStillNeeded = numCyborgsToSend - totalSent;
    printErr(`numCyborgsStillNeeded: ${numCyborgsStillNeeded}`);

    // get my closest spare factory to the target factory
    const closestSpareFactoryId = findClosestFactoryId(Object.keys(myFactoriesWithSpareCyborgs), targetFactoryId);
    printErr(`closestSpareFactoryId: ${closestSpareFactoryId}`);
    const maxSpareCyborgs = myFactoriesWithSpareCyborgs[closestSpareFactoryId];
    printErr(`maxSpareCyborgs: ${maxSpareCyborgs}`);

    if (maxSpareCyborgs > numCyborgsStillNeeded) {
      // add as many as neccesary to the move
      move = addToMove(move, closestSpareFactoryId, targetFactoryId, numCyborgsStillNeeded);
      totalSent += numCyborgsStillNeeded; // essentially a break
    } else {
      move = addToMove(move, closestSpareFactoryId, targetFactoryId, maxSpareCyborgs);
      totalSent += maxSpareCyborgs;
    }
    printErr(`totalSent: ${totalSent}`);
    // delete that factory from our array so we don't double count
    delete myFactoriesWithSpareCyborgs[closestSpareFactoryId];
  }

  return move;
}

/* Potentially returns a bomb move */
function bombStrategy() {
  if (Object.keys(factoriesByOwner[ENEMY_ENTITY]).length > 0) {
    let maybeBombMove = null;
    if (!sentInitialBomb) {
      maybeBombMove = getPossibleInitalBombMove();
      printErr(`maybeBombMove: ${maybeBombMove}`);
    }

    if (maybeBombMove) {
      return maybeBombMove;
    }

    return getPossibleRetaliationBomb();
  }

  return null; // no factories to attack
}

function getPossibleInitalBombMove() {
  const targetFactoryId = getPossibleInitialBombTarget(factoriesByOwner[ENEMY_ENTITY]);
  if (targetFactoryId) {
    const fromFactoryId = findClosestFactoryId(Object.keys(factoriesByOwner[MY_ENTITY]), targetFactoryId);
    sentInitialBomb = true;
    return `${BOMB} ${fromFactoryId} ${targetFactoryId}`;
  } else {
    return null;
  }
}

/**
 * Looks for a good target to bomb close to the start of the game. Goal is to decimate a high production factory
 * with close to MIN_CYBORGS_DESTROYED_BY_BOMB cyborgs currently at the factory
 *
 * TODO if we want to actually attack this factory while it is down, we should try to target a close one
 *
 * @param factories Factories to consider as target
 * @returns targetFactoryId if a good one exists, null otherwise
 */
function getPossibleInitialBombTarget(factories) {
  const threshold = 3; // Defines range for numCyborgs for the targetFactory. As of now it is MIN_CYBORGS_DESTROYED_BY_BOMB +/- threshold

  let possibleTargetFactoryIds = Object.keys(factories).filter((factoryId) => {
    const numEnemyCyborgs = factories[factoryId].numCyborgs;
    numEnemyCyborgs >= MIN_CYBORGS_DESTROYED_BY_BOMB - threshold && numEnemyCyborgs <= MIN_CYBORGS_DESTROYED_BY_BOMB + threshold;
  });

  if (possibleTargetFactoryIds.length) {
    possibleTargetFactoryIds.sort(function (id1, id2) {
      if (factories[id1].prodRate > factories[id2].prodRate) {
        return -1; // id1 is better
      }
      return 1; // id2 is equal or better
    });
    return possibleTargetFactoryIds[0]; // Ordered so first one is highest prod rate
  }

  return null;
}

/**
 * Send a bomb back if the enemy sent one at us and we have a good target to it
 *
 * @returns bomb move if we go for it, null otherwise
 */
function getPossibleRetaliationBomb() {
  if (!retaliatedOnThatBish && Object.keys(bombsByOwner[ENEMY_ENTITY]).length) {
    const enemyFactoriesWithMaxProdRate = Object.keys(factoriesByOwner[ENEMY_ENTITY]).filter((factoryId) => factoriesByOwner[ENEMY_ENTITY][factoryId].prodRate === MAX_PROD_RATE);
    if (!isEmpty(enemyFactoriesWithMaxProdRate)) {
      const bestEnemyFactoryId = enemyFactoriesWithMaxProdRate.reduce((a, b) => {
          return factoriesByOwner[ENEMY_ENTITY][a] > factoriesByOwner[ENEMY_ENTITY][b] ? a : b;
      });

      if (bestEnemyFactoryId) {
        retaliatedOnThatBish = true;
        const myStartingFactory = factoriesByOwner[MY_ENTITY][1] ? 1 : 2;
        printErr('sendingRetaliationBomb');
        // TODO: assumes we always start at factory 1 or 2 and own it forever :D
        return `${BOMB} ${myStartingFactory} ${bestEnemyFactoryId}`;
      }
    }
  }
  // if they don't have a prodRate=3 or haven't sent a bomb, don't retaliate
  return null;
}

function addToMove(moveSoFar, fromFactoryId, targetFactoryId, numCyborgsToSend, bombMove = null) {
  if (moveSoFar === WAIT) {
    moveSoFar = bombMove || `${MOVE} ${fromFactoryId} ${targetFactoryId} ${numCyborgsToSend}`;
  } else {
    moveSoFar += bombMove ? `;${bombMove}` : `;${MOVE} ${fromFactoryId} ${targetFactoryId} ${numCyborgsToSend}`;
  }
  // printErr(`moveSoFar: ${moveSoFar}`);
  return moveSoFar;
}

// PRECONDITION: myFactoryId has to be an id of a factory owned by MY_ENTITY
function getMyBaseArmySize(myFactoryId) {
  if (!factoriesByOwner[MY_ENTITY].hasOwnProperty(myFactoryId)) {
    printErr("Precondition broken in getMyBaseArmySize.");
  }

  const closestFactoryId = findClosestFactoryId(Object.keys(factoriesByOwner[ENEMY_ENTITY]), myFactoryId);
  // prod rate * (current number of our cyborgs) / (dist from their closest factory)

  if (closestFactoryId === null) { // No factories left
    return allFactories[myFactoryId].prodRate * getNumCyborgs(MY_ENTITY) * MBASC;
  }

  if (!distanceFrom[closestFactoryId][myFactoryId]) {
    printErr("Divide by zero in getMyBaseArmySize. Probably because the factory ids are the same");
  }

  return allFactories[myFactoryId].prodRate * getNumCyborgs(MY_ENTITY) * MBASC / distanceFrom[closestFactoryId][myFactoryId];
}

/**
 * @param owner Entity as defined at top (MY_ENTITY, ENEMY_ENTITY)
 * @returns {number} The number of cyborgs owned by the given owner. Includes factories and troops
 */
function getNumCyborgs(owner) {
  if (owner === NEUTRAL_ENTITY) {
    printErr('NEUTRAL ENTITY NOT ALLOWED IN GET NUM CYBORGS');
    return 0;
  }

  const ownerTroops = troopsByOwner[owner];
  const ownerFactories = factoriesByOwner[owner];

  const numCyborgsInFactories = Object.keys(ownerFactories).map((id) => ownerFactories[id].numCyborgs).reduce((a, b) => a + b, 0);
  const numCyborgsInTroops = Object.keys(ownerTroops).map((id) => ownerTroops[id].numCyborgs).reduce((a, b) => a + b, 0);
  return numCyborgsInFactories + numCyborgsInTroops;
}

function initTurn(entityCount) {
  allFactories = {};
  factoriesByOwner = {[MY_ENTITY]: {}, [NEUTRAL_ENTITY]: {}, [ENEMY_ENTITY]: {}};
  troopsByOwner = {[MY_ENTITY]: {}, [ENEMY_ENTITY]: {}};
  bombsByOwner = {[MY_ENTITY]: {}, [ENEMY_ENTITY]: {}};

  for (let i = 0; i < entityCount; i++) {
    const inputs = readline().split(' ');
    const entityId = parseInt(inputs[0], 10);
    const entityType = inputs[1];

    if (entityType === FACTORY) {
      saveFactory(entityId, parseInt(inputs[2], 10), parseInt(inputs[3], 10), parseInt(inputs[4], 10));
    } else if (entityType === TROOP) {
      saveTroop(entityId, parseInt(inputs[2], 10), parseInt(inputs[3], 10), parseInt(inputs[4], 10), parseInt(inputs[5], 10), parseInt(inputs[6], 10));
    } else if (entityType === BOMB) {
      saveBomb(entityId, parseInt(inputs[2], 10), parseInt(inputs[3], 10), parseInt(inputs[4], 10), parseInt(inputs[5], 10));
    }
  }
}

function saveFactory(id, owner, numCyborgs, prodRate) {
  allFactories[id] = {owner, numCyborgs, prodRate};
  factoriesByOwner[owner][id] = {numCyborgs, prodRate};
}

function saveTroop(id, owner, fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival) {
  troopsByOwner[owner][id] = {fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival};
}

function saveBomb(id, owner, fromFactoryId, targetFactoryId, turnsLeftUntilArrival) {
  bombsByOwner[owner][id] = {fromFactoryId, targetFactoryId, turnsLeftUntilArrival};
}

// TODO this should take neutral vs enemy into account (enemy's factories will produce more cyborgs in the time we take to arrive)
// TODO should take into account any troops going toward the targetFactory (maybe should use calculateNumCyborgsToSend rather than targetFactory.numCyborgs
// TODO this should use the average distance from each of our factories to the targetFactoryId instead of just the single largest factory (due to my multi MOVE change)
function getFactoryRatios(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs) {
  const enemyAndNeutralFactoryIds = Object.keys(allFactories).filter((f) => allFactories[f].owner !== MY_ENTITY);
  const factoryRatios = {};

  for (let i = 0; i < enemyAndNeutralFactoryIds.length; i++) {
    const targetFactoryId = enemyAndNeutralFactoryIds[i];
    const targetFactory = allFactories[targetFactoryId];
    const distance = getSpareFactoryWeightedDistance(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs, targetFactoryId);

    // const distance = distanceFrom[ourFactoryId][targetFactoryId];
    const predictedNumCyborgs = predictNumCyborgs(targetFactoryId, distance);
    factoryRatios[targetFactoryId] = targetFactory.prodRate / (predictedNumCyborgs + 1) / (distance * RDC);
  }

  return factoryRatios;
}

/**
 * Predicts the numCyborgs at a factory in numTurns turns. Takes into account the current numCyborgs, incoming troops of the current owner, and the production rate
 * TODO: this assumes that the factory will not change owners in this time (doesn't take into account any of the non-owner's incoming troops)
 *
 * @param factoryId
 * @param numTurns
 */
function predictNumCyborgs(factoryId, numTurns) {
  const factory = allFactories[factoryId];
  const owner = factory.owner;
  let futureNumCyborgs = factory.numCyborgs; // current num 'borgs
  if (owner !== NEUTRAL_ENTITY) {
    futureNumCyborgs += numTurns * factory.prodRate; // add production over time
  }
  const ownerTroops = troopsByOwner[owner];

  // Add incoming troops that will make it to the factory by the end of numTurns turns
  for (let troopId in ownerTroops) {
    if (ownerTroops[troopId].targetFactoryId === factoryId && ownerTroops[troopId].turnsLeftUntilArrival <= numTurns) {
      futureNumCyborgs += ownerTroops[troopId].numCyborgs;
    }
  }

  return futureNumCyborgs;
}


function getTargetFactoryId(myFactoriesWithSpareCyborgs, factoryRatios, totalNumSpareCyborgs) {
  // Don't leave fewer than myBaseArmySize behind at any of my factories
  let bestFactoryId = null;
  let numCyborgsToSend = null;
  const nonZeroFactoryRatioIds = Object.keys(factoryRatios).filter(a => factoryRatios[a] > 0);
  printErr(`nonZeroFactoryRatios ${nonZeroFactoryRatioIds}`);
  while (bestFactoryId == null && nonZeroFactoryRatioIds.length > 0) {
    // Find factory with highest ratio
    bestFactoryId = nonZeroFactoryRatioIds.reduce((a, b) => {
      return factoryRatios[a] > factoryRatios[b] ? a : b;
    });

    const weightedDistance = getSpareFactoryWeightedDistance(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs, bestFactoryId);

    numCyborgsToSend = calculateNumCyborgsToSend(weightedDistance, bestFactoryId);

    // printErr(`numCyborgsToSend: ${numCyborgsToSend}`);
    // printErr(`numSpareCyborgs: ${totalNumSpareCyborgs}`);

    // if we already have enough cyborgs en route, don't bother
    if (getNumTroopsEnRoute(bestFactoryId, weightedDistance)) {
      nonZeroFactoryRatioIds.splice(nonZeroFactoryRatioIds.indexOf(bestFactoryId), 1);
      bestFactoryId = null;
    }

    // if we don't have enough cyborgs total to spare, try next best target factory
    if (numCyborgsToSend > totalNumSpareCyborgs) {
      nonZeroFactoryRatioIds.splice(nonZeroFactoryRatioIds.indexOf(bestFactoryId), 1);
      bestFactoryId = null;
    }

    // TODO Shouldn't this only break if length is 0 since that means we are out of factories to try? -- Sean
    // I think we can remove this now that I added another condition to the while loop
    // printErr("length: " + Object.keys(nonZeroFactoryRatios).length);
    // if (Object.keys(nonZeroFactoryRatios).length) {
    //   printErr("breaking");
    //   break;
    // }
  }

  return bestFactoryId;
}


function getMyFactoriesWithSpareCyborgs(myFactories) {
  const myFactoriesWithSpareCyborgs = {};
  Object.keys(myFactories).map((myFactoryId) => {
    const myBaseArmySize = getMyBaseArmySize(myFactoryId);
    printErr(`myFactoryId ${myFactoryId}'s myBaseArmySize is ${myBaseArmySize}`);
    const cyborgsAtFactory = myFactories[myFactoryId].numCyborgs;

    if (cyborgsAtFactory > myBaseArmySize) {
      myFactoriesWithSpareCyborgs[myFactoryId] = cyborgsAtFactory - Math.round(myBaseArmySize);
    }
  });
  return myFactoriesWithSpareCyborgs;
}

function getTotalSpareCyborgs(factoriesWithSpareCyborgs) {
  return Object.values(factoriesWithSpareCyborgs).reduce((acc, spare) => {
    return acc + spare;
  }, 0);
}

/**
 * @param weightedDistance The weighted distance from our spare cyborg factories to the target factory
 * @param targetFactoryId The id of the factory to send cyborgs to
 * @return {number} The number of cyborgs to send
 *
 * IMPLEMENTATION: (predicted # of cyborgs defending the target factory on arrival + 1 + cushion)
 */
function calculateNumCyborgsToSend(weightedDistance, targetFactoryId) {
  const predictedNumCyborgs = predictNumCyborgs(targetFactoryId, weightedDistance);
  return Math.round(predictedNumCyborgs) + 1 + calculateCushion(weightedDistance, targetFactoryId);
}

/**
 *
 * @param distanceFromUs The weighted distance the target is from us
 * @param targetFactoryId The the id of the factory to send cyborgs to
 * @returns {number/null} The number to cyborgs to act as our "cushion" to avoid being defeated by the opponent at the targetFactory, null if no enemy factories exist
 *
 * IMPLEMENTATION: returns (distance from us / distance from their closest factory) rounded to nearest whole number
 * TODO maybe should also take into the account of the number of cyborgs they have at their factories. Their biggest threat may be farther away but have a lot more cyborgs. It would be only a fraction of their numCyborgs since they probably won't send all of them and leave their factory unguarded
 */
function calculateCushion(distanceFromUs, targetFactoryId) {
  const enemyFromFactoryId = findClosestFactoryId(Object.keys(factoriesByOwner[ENEMY_ENTITY]), targetFactoryId);
  if (enemyFromFactoryId !== null) {
    const distanceFromThem = distanceFrom[enemyFromFactoryId][targetFactoryId];
    return Math.round(distanceFromUs / Math.max(distanceFromThem, 1));
  }
  return 0;
}

// Figure out which factory is closest to the factory given by factoryId
function findClosestFactoryId(factoryIds, factoryId) {
  if (factoryIds.length === 0) {
    return null;
  }

  return factoryIds.reduce((a, b) => {
    return distanceFrom[a][factoryId] < distanceFrom[b][factoryId] ? a : b;
  });
}


function getNumTroopsEnRoute(targetFactoryId, numTurns) {
  let numTroopsEnRoute = 0;
  for (let troopId in troopsByOwner[MY_ENTITY]) {
    if (troopsByOwner[MY_ENTITY][troopId].turnsLeftUntilArrival <= numTurns) {
      numTroopsEnRoute += troopsByOwner[MY_ENTITY][troopId].numCyborgs;
    }
  }

  return numTroopsEnRoute;
}

function isEmpty(dict) {
  return Object.keys(dict).length === 0;
}

initGame();
playGame();

