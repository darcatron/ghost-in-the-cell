/*
  By: Mathurshan Vimalesvaran, Sean Deneen
  Last Modified: Mar 2nd, 2017
*/

// TODO:
// Bomb Strategy
  // early on destroy their 3 and take it over
  // maybe use them as a retaliation? e.g. if they send a bomb, we'll send a bomb just to start
  // if the enemy bomb hits, don't count the prod rate for 5 turns when predicting num cyborgs (edge case?)
// Factory upgrade strategy
  // valuable for prodRate=0 factories
    // if it's far away from enemies
    // if it's close to lots of our factories
    // if we have 10 + (estimated baseArmySize for a prodRate=0 factory assuming it has a prodRate=1) spare troops
      // move the spare troops there and level up that factory
      // maybe do this if we finish all of our moves but still have 10+ spare at a single factory?


// BONUS: (visit if we have time)
// consider letting the enemy reduce the number of cyborgs at a neutral factory (may not work)

const FACTORY = 'FACTORY';
const TROOP = 'TROOP';
const BOMB = 'BOMB';
const MOVE = 'MOVE';
const WAIT = 'WAIT';
const UPGRADE = 'INC';
const MY_ENTITY = 1;
const ENEMY_ENTITY = -1;
const NEUTRAL_ENTITY = 0;

/* Coefficents */
const RDC = 5; // ratio distance - prioritize shorter distance from us when calculating the ratio TODO this does absolutely nothing. Just an extra number to multiply at the end of each ratio. Should probably turn the ratios into adding. Something like: (PR / MAX_PR) - (numBorgs / total_borgs) - coef*(distance)
const MBASC = 0.07; // my base army size - reduce the rate at which the base army size increases
const CUSHC = 3; // increase cushion (need to send more troops if factory is far from us and close to them

const distanceFrom = {}; // factoryA to factoryB
const MAX_PROD_RATE = 3;
const MIN_CYBORGS_DESTROYED_BY_BOMB = 10;
const CYBORGS_PER_UPGRADE = 10;

// changes by turn
let retaliatedOnThatBish = false;
let sentInitialBomb = false;

let allFactories = {};
let factoriesByOwner = {};
let bombsByOwner = {};
let allTroops = {};
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
    if (isEmpty(myFactories)) {
      // Have to wait if we have no factories
      print(WAIT);
      continue;
    }

    const myFactoriesWithSpareCyborgs = getMyFactoriesWithSpareCyborgs(myFactories);
    let totalNumSpareCyborgs = getTotalSpareCyborgs(myFactoriesWithSpareCyborgs);
    const factoryRatios = getFactoryRatios(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs);
    printErr(`factoryRatios: ${JSON.stringify(factoryRatios)}`);

    // Go for a single defend first before looking to attack
    let targetFactoryId = getDefendTargetFactoryId(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs);

    if (!targetFactoryId) {
      targetFactoryId = getAttackTargetFactoryId(myFactoriesWithSpareCyborgs, factoryRatios, totalNumSpareCyborgs);
    }

    while (targetFactoryId) {
      printErr("targetFactoryId: " + targetFactoryId);
      move = getTroopMoves(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs, targetFactoryId, move);
      printErr(`move so far: ${move}`);
      totalNumSpareCyborgs = getTotalSpareCyborgs(myFactoriesWithSpareCyborgs);
      delete factoryRatios[targetFactoryId];
      targetFactoryId = getAttackTargetFactoryId(myFactoriesWithSpareCyborgs, factoryRatios, totalNumSpareCyborgs);
    }

    const maybeBombMove = bombStrategy();
    if (maybeBombMove) {
      move = addToMove(move, BOMB, maybeBombMove.fromFactoryId, maybeBombMove.targetFactoryId);
    }

    if (move == WAIT) {
      // Stupid strategy... instead of waiting, increment our largest factory with prod rate < 3
      let possibleUpgradeId = tryFactoryUpgradeInsteadOfWait();
      if (possibleUpgradeId !== null) {
        move = addToMove(move, UPGRADE, possibleUpgradeId);
      }
    }

    print(move);
    // To debug: printErr('Debug messages...');
  }
}

// returns an id of a factory to upgrade if one exists, otherwise returns null
function tryFactoryUpgradeInsteadOfWait() {
  const possibleIds = getPossibleFactoryIdsToUpgrade(factoriesByOwner[MY_ENTITY]);

  // printErr("possibleIds for upgrade: " + JSON.stringify(possibleIds));

  if (possibleIds.length) {
    bestFactoryId = possibleIds.reduce((id1, id2) => {
      return factoriesByOwner[MY_ENTITY][id1] > factoriesByOwner[MY_ENTITY][id2] ? id1 : id2;
    });
    return bestFactoryId;
  }

  return null;
}

function getPossibleFactoryIdsToUpgrade(factories) {
  return Object.keys(factories).filter((factoryId) => {
    return factories[factoryId].prodRate < MAX_PROD_RATE && factories[factoryId].numCyborgs >= CYBORGS_PER_UPGRADE;
  });
}

// Returns factoryId of factory to defend if a good one exists
// Returns null if no good factories to defend are found
function getDefendTargetFactoryId(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs) {
  const possibleDefendFactories = {}; // going to be a map of factoryId -> numCyborgsToSend
  for (let factoryId in factoriesByOwner[MY_ENTITY]) {
    // Find average distance weighted by spare cyborgs from all my other factories
    let weightedDistance = getSpareFactoryWeightedDistance(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs, factoryId);
    let numCyborgsToSend = calculateNumCyborgsToSend(weightedDistance, factoryId);
    if (numCyborgsToSend <= totalNumSpareCyborgs && numCyborgsToSend > 0) {
      possibleDefendFactories[factoryId] = numCyborgsToSend;
    }
  }

  if (isEmpty(possibleDefendFactories)) {
    return null;
  }

  // Choose best factoryId from possible factory ids
  return Object.keys(possibleDefendFactories).reduce((id1, id2) => {
    const numCyborgsToSend1 = possibleDefendFactories[id1];
    const numCyborgsToSend2 = possibleDefendFactories[id2];

    return getDefendRatio(id1, numCyborgsToSend1) > getDefendRatio(id2, numCyborgsToSend2) ? id1 : id2;
  });
}

function getDefendRatio(factoryId, numCyborgsToSend) {
  const factory = allFactories[factoryId];
  return numCyborgsToSend * factory.prodRate; // TODO this is very simple. Optimize?
}

function getSpareFactoryWeightedDistance(spareFactories, totalSpareCyborgs, targetFactoryId) {
  return Object.keys(spareFactories).reduce((acc, spareFactoryId) => {
    // Don't include the target factory!!!
    if (spareFactoryId == targetFactoryId) {
      return acc;
    }
    const weight = spareFactories[spareFactoryId] / totalSpareCyborgs;
    return acc + (distanceFrom[spareFactoryId][targetFactoryId] * weight);
  }, 0);
}

// Side effect: decrements myFactoriesWithSpareCyborgs as we use them
// Precondition: We have enough factories with spare cyborgs make a good move on targetFactoryId
function getTroopMoves(myFactoriesWithSpareCyborgs, totalSpareCyborgs, targetFactoryId, move) {
  // MATUSH TODAY - 5
    // this should already be known from before
  const weightedDistance = getSpareFactoryWeightedDistance(myFactoriesWithSpareCyborgs, totalSpareCyborgs, targetFactoryId);
  const numCyborgsToSend = calculateNumCyborgsToSend(weightedDistance, targetFactoryId);
  let totalSent = 0;
  let closestSpareFactoryId = null
  // get more moves while the total cyborgs to send isn't reached
  while (totalSent !== numCyborgsToSend) {
    const numCyborgsStillNeeded = numCyborgsToSend - totalSent;
    // printErr(`numCyborgsStillNeeded: ${numCyborgsStillNeeded}`);

    // get my closest spare factory to the target factory
    closestSpareFactoryId = findClosestFactoryId(Object.keys(myFactoriesWithSpareCyborgs), targetFactoryId);
    // printErr(`closestSpareFactoryId: ${closestSpareFactoryId}`);

    if (closestSpareFactoryId == targetFactoryId) {
      break; // We are trying to send cyborgs to ourselves.... bad
    }

    const maxSpareCyborgs = myFactoriesWithSpareCyborgs[closestSpareFactoryId];
    // printErr(`maxSpareCyborgs: ${maxSpareCyborgs}`);

    if (maxSpareCyborgs > numCyborgsStillNeeded) {
      // add as many as neccesary to the move
      move = addToMove(move, MOVE, closestSpareFactoryId, targetFactoryId, numCyborgsStillNeeded);
      totalSent += numCyborgsStillNeeded; // essentially a break
      myFactoriesWithSpareCyborgs[closestSpareFactoryId] -= numCyborgsStillNeeded;
    } else {
      move = addToMove(move, MOVE, closestSpareFactoryId, targetFactoryId, maxSpareCyborgs);
      totalSent += maxSpareCyborgs;
      delete myFactoriesWithSpareCyborgs[closestSpareFactoryId];
    }
    // printErr(`totalSent: ${totalSent}`);
  }

  return move;
}

/* Potentially returns a bomb move */
function bombStrategy() {
  if (!isEmpty(factoriesByOwner[ENEMY_ENTITY])) {
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

// Returns dict with fromFactoryId and targetFactoryId, or null if no good moves
function getPossibleInitalBombMove() {
  const targetFactoryId = getPossibleInitialBombTarget(factoriesByOwner[ENEMY_ENTITY]);
  if (targetFactoryId && !isMyBombEnRoute(targetFactoryId)) {
    const fromFactoryId = findClosestFactoryId(Object.keys(factoriesByOwner[MY_ENTITY]), targetFactoryId);
    printErr("sending initial bomb");
    sentInitialBomb = true;
    return {fromFactoryId, targetFactoryId};
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
    return numEnemyCyborgs >= MIN_CYBORGS_DESTROYED_BY_BOMB - threshold &&
           numEnemyCyborgs <= MIN_CYBORGS_DESTROYED_BY_BOMB + threshold
  });

  printErr("possibleInitialBombTargets: " + JSON.stringify(possibleTargetFactoryIds));

  if (possibleTargetFactoryIds.length) {
    possibleTargetFactoryIds.sort(function (id1, id2) {
      if (factories[id1].prodRate > factories[id2].prodRate) {
        return -1; // id1 is better
      } else if (factories[id1].prodRate == factories[id2].prodRate) {
        if (getClosestDistanceToFactories(factoriesByOwner[MY_ENTITY], factories[id1]) <= getClosestDistanceToFactories(factoriesByOwner[MY_ENTITY], factories[id2])) {
          return -1; // id1 is equal or better
        } else {
          return 1; // id2 is better
        }
      } else {
        return 1; // id2 is better
      }
    });
    return possibleTargetFactoryIds[0]; // Ordered so first one is highest prod rate
  }

  return null;
}

function isMyBombEnRoute(targetFactoryId) {
  for (bombId in bombsByOwner[MY_ENTITY]) {
    if (bombsByOwner[MY_ENTITY][bombId].targetFactoryId == targetFactoryId) {
      return true;
    }
  }

  return false;
}

function getClosestDistanceToFactories(factories, factoryId) {
  const myClosestFactoryId = findClosestFactoryId(factories, factoryId);
  return distanceFrom[factoryId][myClosestFactoryId];
}

/**
 * Send a bomb back if the enemy sent one at us and we have a good target to it
 *
 * @returns dict with fromFactoryId and targetFactoryId, or null if no good move
 */
function getPossibleRetaliationBomb() {
  if (!retaliatedOnThatBish && !isEmpty(bombsByOwner[ENEMY_ENTITY])) {
    const enemyFactoriesWithMaxProdRate = Object.keys(factoriesByOwner[ENEMY_ENTITY]).filter((factoryId) => factoriesByOwner[ENEMY_ENTITY][factoryId].prodRate === MAX_PROD_RATE);
    if (!isEmpty(enemyFactoriesWithMaxProdRate)) {
      const targetFactoryId = enemyFactoriesWithMaxProdRate.reduce((a, b) => {
          return factoriesByOwner[ENEMY_ENTITY][a] > factoriesByOwner[ENEMY_ENTITY][b] ? a : b;
      });

      if (targetFactoryId && !isMyBombEnRoute(targetFactoryId)) {
        retaliatedOnThatBish = true;
        const fromFactoryId = findClosestFactoryId(Object.keys(factoriesByOwner[MY_ENTITY]), targetFactoryId);
        printErr('sendingRetaliationBomb: ' + JSON.stringify({fromFactoryId, targetFactoryId}));
        return {fromFactoryId, targetFactoryId};
      }
    }
  }
  // if they don't have a prodRate=3 or haven't sent a bomb, don't retaliate
  return null;
}

function addToMove(moveSoFar, moveType, fromFactoryId, targetFactoryId = null, numCyborgsToSend = null) {
  let newMove = `${moveType} ${fromFactoryId}`;
  if (targetFactoryId !== null) {
    newMove += ` ${targetFactoryId}`;
  }
  if (numCyborgsToSend !== null) {
    newMove += ` ${numCyborgsToSend}`;
  }

  if (moveSoFar === WAIT) {
    moveSoFar = newMove;
  } else {
    moveSoFar += `; ${newMove}`;
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
  allTroops = {};
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
  allTroops[id] = {owner, fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival};
  troopsByOwner[owner][id] = {fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival};
}

function saveBomb(id, owner, fromFactoryId, targetFactoryId, turnsLeftUntilArrival) {
  bombsByOwner[owner][id] = {fromFactoryId, targetFactoryId, turnsLeftUntilArrival};
}

// TODO this should take neutral vs enemy into account (enemy's factories will produce more cyborgs in the time we take to arrive)
// TODO this should use the average distance from each of our factories to the targetFactoryId instead of just the single largest factory (due to my multi MOVE change)
function getFactoryRatios(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs) {
  const enemyAndNeutralFactoryIds = Object.keys(allFactories).filter((f) => allFactories[f].owner !== MY_ENTITY);
  const factoryRatios = {};

  for (let i = 0; i < enemyAndNeutralFactoryIds.length; i++) {
    const targetFactoryId = enemyAndNeutralFactoryIds[i];
    const targetFactory = allFactories[targetFactoryId];
    const distance = getSpareFactoryWeightedDistance(myFactoriesWithSpareCyborgs, totalNumSpareCyborgs, targetFactoryId);

    const predictedNumCyborgs = predictNumCyborgs(targetFactoryId, distance); // Returns negative number for enemies
    if (predictedNumCyborgs <= 0) {
      // printErr("ratio for factory " + targetFactoryId + ": " + targetFactory.prodRate + " / (" + (-1 * predictedNumCyborgs) + " + 1) / (" + distance + " * " + RDC);
      factoryRatios[targetFactoryId] = targetFactory.prodRate / ((-1 * predictedNumCyborgs) + 1) / (distance * RDC);
    } else {
      factoryRatios[targetFactoryId] = 0 // We are predicted to own the factory, don't prioritize at all
    }
  }

  return factoryRatios;
}

/**
 * Predicts the numCyborgs at a factory in numTurns turns. Takes into account the current numCyborgs, incoming troops from both sides, and the production rate
 * NOTE: this assumes that the factory will not change owners in this time (production rate is assumed to be for the current owner even though the owner might change)
 *
 * @param factoryId
 * @param numTurns
 * @returns {number} A negative number means the enemy will have that many cyborgs after numTurns turns, positive number means we will have that many cyborgs
 */
function predictNumCyborgs(factoryId, numTurns) {
  // printErr("factoryID: " + factoryId + " numTurns: " + numTurns);
  const factory = allFactories[factoryId];
  const owner = factory.owner;
  let futureNumCyborgs = 0;

  // Deal with troops incoming to the factory. This is so fun!
  const troopsEnRoute = getTroopsEnRoute(factoryId, numTurns);

  // If neutral, get number of cyborgs for each owner that will be lost fighting neutral guard cyborgs
  let cyborgsLostToNeutralByOwner = null;
  if (owner === NEUTRAL_ENTITY) {
    cyborgsLostToNeutralByOwner = predictCyborgsLostToNeutralByOwner(factoryId, numTurns, troopsEnRoute);
    const numCyborgsLostByNeutral = cyborgsLostToNeutralByOwner[MY_ENTITY] + cyborgsLostToNeutralByOwner[ENEMY_ENTITY]; // These are the neutral guards that died
    if (numCyborgsLostByNeutral > factory.numCyborgs) {
      printErr("Programming error: neutral can't lose more than it had originally!");
    }
    futureNumCyborgs += factory.numCyborgs - numCyborgsLostByNeutral; // Subtract neutral guard cyborgs that got wrecked
    futureNumCyborgs *= -1; // Negative for neutral cyborgs
  } else {
    // Not neutral!
    futureNumCyborgs += factory.numCyborgs * owner; // current num 'borgs (positive for us, negative for enemy)
    futureNumCyborgs += numTurns * factory.prodRate * owner; // add production over time (positive for us, negative for enemy)
  }

  // printErr("future borgs1: " + futureNumCyborgs);

  // Now go through tropsEnRoute and see what they will do.
  for (let troopId in troopsEnRoute) {
    const troop = troopsEnRoute[troopId];
    futureNumCyborgs += troop.numCyborgs * troop.owner; // positive for us, negative for enemy
  }
  // printErr("future borgs2: " + futureNumCyborgs);

  // Don't forget to cancel out the cyborgsLostToNeutralOwner for both owners
  if (cyborgsLostToNeutralByOwner) {
    futureNumCyborgs -= cyborgsLostToNeutralByOwner[MY_ENTITY]; // we lost some
    futureNumCyborgs += cyborgsLostToNeutralByOwner[ENEMY_ENTITY]; // they lost some
  }

  // printErr("future borgs3: " + futureNumCyborgs);
  return futureNumCyborgs;
}

// PRECONDITION: factoryId is the id of a neutral factory!
// Simulates the next numTurns turns based on troops incoming to factory with id = factoryId
// Returns a dictionary with key of owner and value of num cyborgs lost
function predictCyborgsLostToNeutralByOwner(factoryId, numTurns, troopsEnRoute) {
  const cyborgsLost = {[MY_ENTITY] : 0, [ENEMY_ENTITY] : 0};

  if (!factoriesByOwner[NEUTRAL_ENTITY].hasOwnProperty(factoryId)) {
    printErr("PRECONDITION broken in predictCyborgsLostToNeutralByOwner: " + factoryId + " is not an id of a neutral factory!");
    return cyborgsLost;
  }

  const neutralFactory = factoriesByOwner[NEUTRAL_ENTITY][factoryId];
  let neutralGuardsLeft = neutralFactory.numCyborgs;

  const troopIdsByNumTurns = getTroopIdsByNumTurns(troopsEnRoute);

  // printErr("troopIdsByNumTurns: " + JSON.stringify(troopIdsByNumTurns));

  // Add lost cyborgs for each troop (stop early if we have no neutral guards left)
  for (let troopId of troopIdsByNumTurns) {
    if (neutralGuardsLeft > 0) {
      const troop = troopsEnRoute[troopId];
      if (troop.numCyborgs >= neutralGuardsLeft) {
        cyborgsLost[troop.owner] += neutralGuardsLeft;
        neutralGuardsLeft = 0;
      } else {
        cyborgsLost[troop.owner] += troop.numCyborgs;
        neutralGuardsLeft -= troop.numCyborgs;
      }
    } else {
      break; // No guards left
    }
  }

  // printErr("cyborgs lost by neutral: " + JSON.stringify(cyborgsLost));
  return cyborgsLost;
}


function getTroopsEnRoute(targetFactoryId, numTurns) {
  // printErr("targFactoryId: " + targetFactoryId + ", numTurns: " + numTurns);
  // printErr("allTroops: " + JSON.stringify(allTroops));

  let troopsEnRoute = {};
  for (let troopId in allTroops) {
    let troop = allTroops[troopId];
    // printErr("testing troop " + troopId + ": " + JSON.stringify(troop));
    if (troop.targetFactoryId == targetFactoryId && troop.turnsLeftUntilArrival <= numTurns) {
      // printErr("got troop!: " + JSON.stringify(troop));
      troopsEnRoute[troopId] = troop;
    }
  }

  // printErr("returning troopsEnRoute: " + JSON.stringify(troopsEnRoute));
  return troopsEnRoute;
}

// Sorts troops by numTurnsLeftUntilArrival and returns a list of troopIds in that order. Returns empty list if troops is empty
function getTroopIdsByNumTurns(troops) {
  if (isEmpty(troops)) {
    return [];
  }

  const troopIds = Object.keys(troops);
  return troopIds.sort(function (id1, id2) {
    if (troops[id1].turnsLeftUntilArrival <= troops[id2].turnsLeftUntilArrival) {
      return -1; // id1 is equal or better
    } else {
      return 1; // id2 is better
    }
  });
}

// Not sure if we'll need this, but it's here
// function getTroopsEnRouteByOwner(targetFactoryId, numTurns) {
//   let troopsEnRouteByOwner = {[MY_ENTITY] : {}, [ENEMY_ENTITY] : {}};
//   for (let troopId in allTroops) {
//     let troop =  allTroops[troopId];
//     if (troop.targetFactoryId === targetFactoryId && troop.turnsLeftUntilArrival <= numTurns) {
//       troopsEnRouteByOwner[troop.owner][troopId] = troop;
//     }
//   }
//
//   return troopsEnRouteByOwner;
// }


function getAttackTargetFactoryId(myFactoriesWithSpareCyborgs, factoryRatios, totalNumSpareCyborgs) {
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

    printErr(`bestFactoryId: ${bestFactoryId}`);
    printErr(`numCyborgsToSend: ${numCyborgsToSend}`);
    // printErr(`numSpareCyborgs: ${totalNumSpareCyborgs}`);

    // if we don't have enough cyborgs total to spare OR if we don't need to send any,
    // try next best target factory
    if (numCyborgsToSend > totalNumSpareCyborgs || numCyborgsToSend <= 0) {
      nonZeroFactoryRatioIds.splice(nonZeroFactoryRatioIds.indexOf(bestFactoryId), 1);
      bestFactoryId = null;
    }
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
  const predictedNumCyborgs = predictNumCyborgs(targetFactoryId, weightedDistance); // Returns negative number for enemy cyborgs
  const numCyborgsToSend = (-1 * Math.round(predictedNumCyborgs)) + 1 + CUSHC * calculateCushion(weightedDistance, targetFactoryId);
  return Math.max(numCyborgsToSend, 0); // Don't return negative number
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
    // Don't include self
    if (a == factoryId) {
      return b;
    }
    if (b == factoryId) {
      return a;
    }

    return distanceFrom[a][factoryId] < distanceFrom[b][factoryId] ? a : b;
  });
}

function isEmpty(dict) {
  return Object.keys(dict).length === 0;
}

// Note: returns neutral as opposing neutral
function getOpposingOwner(owner) {
  return owner * -1;
}

initGame();
playGame();

