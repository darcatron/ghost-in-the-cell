/*
  By: Mathurshan Vimalesvaran, Sean Deneen
  Last Modified: Feb 26th, 2017
*/

// TODO:
// find factory with the most cyborgs -- DONE
// loop through all other factories
//  get ratio of prodRate:cyborgsDefending:distanceFromUs
// get best factory to attack based on how many cyborgs our largest factory has
// get number of troops to send based on best factory

const FACTORY = 'FACTORY';
const TROOP = 'TROOP';
const MY_ENTITY = 1;
const ENEMY_ENTITY = -1;
const NEUTRAL_ENTITY = 0;

const distanceFrom = {}; // factoryA to factoryB

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
  }
}

function playGame() {
  while (true) {
    const allFactories = {};
    const myFactories = {};
    const enemyFactories = {};
    const troops = {};
    const entityCount = parseInt(readline(), 10); // numb of entities (factories and troops)
    initTurn(entityCount, allFactories, myFactories, enemyFactories, troops);

    // get factory owned with the most cyborgs
    // {id : {numCyborgs : 1, prodRate : 1}}
    const largestFactoryId = Object.keys(myFactories).reduce((a, b) => {
      return myFactories[a].numCyborgs > myFactories[b].numCyborgs ? a : b;
    });

    printErr('largestFactoryId: ', largestFactoryId);


    // To debug: printErr('Debug messages...');

    // Any valid action, such as "WAIT" or "MOVE source destination cyborgs"
    print('WAIT');
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

function getFactoryRatios(allFactories, ourFactory) {
  // TODO: doesn't recognize factory ID 0
  // TODO: there has never been a factory that has a prod rate > 0 with no cyborgs on guard
  // loop through all factories we don't own
    //  get ratio of prodRate:cyborgsDefending:distanceFromUs
  const enemyAndNeutralFactories = Object.keys(allFactories).filter((f) => f.owner !== MY_ENTITY);
  printErr('enemyAndNeutralFactories:', enemyAndNeutralFactories);
  const factoryRatios = {};

  for (let i = 0; i < enemyAndNeutralFactories.length; i++) {
    const targetFactory = allFactories[enemyAndNeutralFactories[i]];
    printErr('targetFactory:', JSON.stringify(targetFactory));
    factoryRatios[i] = targetFactory.prodRate / targetFactory.numCyborgs / distanceFrom[ourFactory][targetFactory];
  }

  return factoryRatios;
}


/**
 * @param fromFactory The factory we are sending cyborgs from
 * @param targetFactory The factory to send cyborgs to
 * @return {number} The number of cyborgs to send
 *
 * IMPLEMENTATION: (# of cyborgs defending the target factory + 1 + cushion)
 */
function calculateNumCyborgsToSend(fromFactory, targetFactory, enemyFactories) {
  return targetFactory.numCyborgs + 1 + calculateCushion(fromFactory, targetFactory, enemyFactories);
}

/**
 *
 * @param ourFromFactory The factory we are sending cyborgs from
 * @param targetFactory The factory to send cyborgs to
 * @param enemyFactories The dictionary of the opponent's factories (maps ids to factories)
 * @returns {number} The number to cyborgs to act as our "cushion" to avoid being defeated by the opponent at the targetFactory
 *
 * IMPLEMENTATION: returns (distance from us / distance from their closest factory) rounded to nearest whole number
 * TODO should also take into the account of the number of cyborgs they have at their factories. Their biggest threat may be farther away but have a lot more cyborgs
 */
function calculateCushion(ourFromFactory, targetFactory, enemyFactories) {
  const distanceFromUs = distanceFrom[ourFromFactory][targetFactory];

  // Figure out which of their factories is closest to targetFactory
  const enemyFromFactory = enemyFactories.reduce((a, b) => {
    distanceFrom[a][targetFactory] > distanceFrom[b][targetFactory] ? a : b;
  });

  const distanceFromThem = distanceFrom[enemyFromFactory][targetFactory];
  return Math.round(distanceFromUs / distanceFromThem);
}



initGame();
playGame();
