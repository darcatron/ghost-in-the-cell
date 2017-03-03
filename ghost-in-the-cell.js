/*
  By: Mathurshan Vimalesvaran, Sean Deneen
  Last Modified: Feb 27th, 2017
*/

// TODO: (in order of what i think is most important - Matush)
// Multiple moves: right now we only get one targetFactory and move a bunch of cyborgs there, but if we have more left to spare we should target another factory!
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
let factoriesByOwner = {};
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

    // TODO: revisit using just this as the value to caluclate ratios. my new multi move method looks at all factories when moving troops
    // get factory owned with the most cyborgs
    const fromFactoryId = Object.keys(myFactories).reduce((a, b) => {
      return myFactories[a].numCyborgs > myFactories[b].numCyborgs ? a : b;
    });

    if (myFactories[fromFactoryId].numCyborgs > 0) {

      printErr(`fromFactoryId: ${fromFactoryId}`);
      const factoryRatios = getFactoryRatios(fromFactoryId);

      printErr(`factoryRatios: ${JSON.stringify(factoryRatios)}`);

      const targetFactoryId = getTargetFactoryId(fromFactoryId, factoryRatios, totalNumSpareCyborgs);

      printErr(`targetFactoryId: ${targetFactoryId}`);
      printErr(`myFactoriesWithSpareCyborgs: ${JSON.stringify(myFactoriesWithSpareCyborgs)}`);

      if (targetFactoryId) {
        const numCyborgsToSend = calculateNumCyborgsToSend(fromFactoryId, targetFactoryId);

        let totalSent = 0;
        // get more moves while the total cyborgs to send isn't reached
        while (totalSent !== numCyborgsToSend) {
          const numCyborgsStillNeeded = numCyborgsToSend - totalSent;
          printErr(`numCyborgsStillNeeded: ${numCyborgsStillNeeded}`);
          // go through each of my spare cyborg factories and get the biggest spare
          let maxSpareCyborgs = 0;
          let maxSpareCyborgsIndex = -1;
          let maxSpareCyborgsFactoryId = -1;
          for (let i = 0; i < myFactoriesWithSpareCyborgs.length; i++) {
            const factoryId = Object.keys(myFactoriesWithSpareCyborgs[i])[0];
            const numSpareCyborgsAtFactory = myFactoriesWithSpareCyborgs[i][factoryId];
            printErr("i: " + i + ", factoryId: " + factoryId + ", numSpareCyborgsAtFactory: " + numSpareCyborgsAtFactory);
            if (numSpareCyborgsAtFactory > maxSpareCyborgs) {
              maxSpareCyborgs = numSpareCyborgsAtFactory;
              maxSpareCyborgsFactoryId = factoryId;
              maxSpareCyborgsIndex = i;
            }
          }
          printErr(`myFactoriesWithSpareCyborgs[maxSpareCyborgsIndex]: ${JSON.stringify(myFactoriesWithSpareCyborgs[maxSpareCyborgsIndex])}`);
          if (maxSpareCyborgs > numCyborgsStillNeeded) {
            // add as many as neccesary to the move
            move = addToMove(move, maxSpareCyborgsFactoryId, targetFactoryId, numCyborgsStillNeeded);
            totalSent += numCyborgsStillNeeded; // essentially a break
          } else {
            move = addToMove(move, maxSpareCyborgsFactoryId, targetFactoryId, maxSpareCyborgs);
            totalSent += maxSpareCyborgs;
          }
          printErr(`totalSent: ${totalSent}`);
          // delete that factory from our array so we don't double count
          myFactoriesWithSpareCyborgs.splice(maxSpareCyborgsIndex, 1);
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
  if (!factoriesByOwner[MY_ENTITY].hasOwnProperty(myFactoryId)) {
    printErr("Precondition broken in getMyBaseArmySize.");
  }

  const closestFactoryId = findClosestFactoryId(factoriesByOwner[ENEMY_ENTITY], myFactoryId);
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

  let ownerTroops = troopsByOwner[owner];
  let ownerFactories = factoriesByOwner[owner];

  const numCyborgsInFactories = Object.keys(ownerFactories).map((id) => ownerFactories[id].numCyborgs).reduce((a, b) => a + b, 0);
  const numCyborgsInTroops = Object.keys(ownerTroops).map((id) => ownerTroops[id].numCyborgs).reduce((a, b) => a + b, 0);
  return numCyborgsInFactories + numCyborgsInTroops;
}

function initTurn(entityCount) {
  allFactories = {};
  factoriesByOwner = {[MY_ENTITY]: {}, [NEUTRAL_ENTITY]: {}, [ENEMY_ENTITY]: {}};
  troopsByOwner = {[MY_ENTITY]: {}, [ENEMY_ENTITY]: {}};

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
  factoriesByOwner[owner][id] = {numCyborgs, prodRate};
}

function saveTroop(id, owner, fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival) {
  troopsByOwner[owner][id] = {fromFactoryId, targetFactoryId, numCyborgs, turnsLeftUntilArrival};
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
    const distance  = distanceFrom[ourFactoryId][targetFactoryId];
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
  futureNumCyborgs += numTurns * factory.prodRate; // add production over time
  const ownerTroops = troopsByOwner[owner];

  // Add incoming troops that will make it to the factory by the end of numTurns turns
  for (troopId in ownerTroops) {
    if (ownerTroops[troopId].targetFactoryId === factoryId && ownerTroops[troopId].turnsLeftUntilArrival <= numTurns) {
      futureNumCyborgs += ownerTroops[troopId].numCyborgs;
    }
  }

  return futureNumCyborgs;
}


function getTargetFactoryId(fromFactoryId, factoryRatios, totalNumSpareCyborgs) {
  // Don't leave fewer than myBaseArmySize behind at any of my factories
  let bestFactoryId = null;
  let numCyborgsToSend = null;
  while (bestFactoryId == null && Object.keys(factoryRatios).length > 0) {
    // Find factory with highest ratio
    bestFactoryId = Object.keys(factoryRatios).reduce((a, b) => {
      return factoryRatios[a] > factoryRatios[b] ? a : b;
    });

    // TODO this is a little wonky because we calculate the number of cyborgs to send based on fromFactoryId when we actually are considering all of our factories when calculating totalSpareCyborgs -- Sean
    numCyborgsToSend = calculateNumCyborgsToSend(fromFactoryId, bestFactoryId);
    printErr(`numCyborgsToSend: ${numCyborgsToSend}`);
    printErr(`numSpareCyborgs: ${totalNumSpareCyborgs}`);

    // if we don't have enough cyborgs total to spare, try next best target factory
    if (numCyborgsToSend > totalNumSpareCyborgs) {
      delete factoryRatios[bestFactoryId];
      bestFactoryId = null;
    }

    // TODO Shouldn't this only break if length is 0 since that means we are out of factories to try? -- Sean
    // I think we can remove this now that I added another condition to the while loop
    // printErr("length: " + Object.keys(factoryRatios).length);
    // if (Object.keys(factoryRatios).length) {
    //   printErr("breaking");
    //   break;
    // }
  }

  return bestFactoryId;
}


function getMyFactoriesWithSpareCyborgs(myFactories) {
  return Object.keys(myFactories).map((myFactoryId) => {
    const myBaseArmySize = getMyBaseArmySize(myFactoryId);
    const cyborgsAtFactory = myFactories[myFactoryId].numCyborgs;

    if (cyborgsAtFactory > myBaseArmySize) {
      return {[myFactoryId] : cyborgsAtFactory - Math.round(myBaseArmySize)};
    }
  }).filter(obj => obj); // filters out null values
}

function getTotalSpareCyborgs(factoriesWithSpareCyborgs) {
  return factoriesWithSpareCyborgs.reduce((acc, val) => {
      // single mapping of myFactoryId : numSpareCyborgs
      return acc + val[Object.keys(val)[0]];
  }, 0);
}

/**
 * @param fromFactoryId The id of the factory we are sending cyborgs from
 * @param targetFactoryId The id of the factory to send cyborgs to
 * @return {number} The number of cyborgs to send
 *
 * IMPLEMENTATION: (predicted # of cyborgs defending the target factory on arrival + 1 + cushion)
 */
function calculateNumCyborgsToSend(fromFactoryId, targetFactoryId) {
  const distance = distanceFrom[fromFactoryId][targetFactoryId];
  const predictedNumCyborgs = predictNumCyborgs(targetFactoryId, distance);
  return predictedNumCyborgs + 1 + calculateCushion(fromFactoryId, targetFactoryId);
}

/**
 *
 * @param ourFromFactoryId The id of the factory we are sending cyborgs from
 * @param targetFactoryId The the id of the factory to send cyborgs to
 * @returns {number/null} The number to cyborgs to act as our "cushion" to avoid being defeated by the opponent at the targetFactory, null if no enemy factories exist
 *
 * IMPLEMENTATION: returns (distance from us / distance from their closest factory) rounded to nearest whole number
 * TODO maybe should also take into the account of the number of cyborgs they have at their factories. Their biggest threat may be farther away but have a lot more cyborgs. It would be only a fraction of their numCyborgs since they probably won't send all of them and leave their factory unguarded
 */
function calculateCushion(ourFromFactoryId, targetFactoryId) {
  const distanceFromUs = distanceFrom[ourFromFactoryId][targetFactoryId];
  const enemyFromFactoryId = findClosestFactoryId(factoriesByOwner[ENEMY_ENTITY], targetFactoryId);
  if (enemyFromFactoryId !== null) {
    const distanceFromThem = distanceFrom[enemyFromFactoryId][targetFactoryId];
    return Math.round(distanceFromUs / Math.max(distanceFromThem, 1));
  } else {
    return 0;
  }
}

// Figure out which of their factories is closest to factory given by factoryId
function findClosestFactoryId(factories, factoryId) {
  if (Object.keys(factories).length === 0) {
    return null;
  }

  return Object.keys(factories).reduce((a, b) => {
    return distanceFrom[a][factoryId] < distanceFrom[b][factoryId] ? a : b;
  });
}

initGame();
playGame();

