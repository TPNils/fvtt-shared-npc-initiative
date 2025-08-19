/**
 * @typedef {object} InitiativeRollDataOptions
 * @property {-1 | 0 | 1} advantageMode
 * @property {boolean} configured
 * @property {(undefined | number | string)} fixed
 * @property {string} flavor
 * @property {boolean} halflingLucky
 * @property {null | number} maximum
 * @property {null | number} minimum
 */

/**
 * @typedef {object} InitiativeRollData
 * @property {object} data
 * @property {InitiativeRollDataOptions} options
 * @property {*} parts
 * @property {Actor} subject
 */

// Skip the roll prompt for dnd5e
Hooks.on(`dnd5e.preConfigureInitiative`, (/** @type {Actor} */actor, /** @type {InitiativeRollData} */rollData) => {
  if (actor.type !== 'npc' || !game.combat) {
    return;
  }
  for (const combatant of game.combat.combatants.values()) {
    if (combatant.actor?.uuid === actor.uuid && typeof combatant.initiative === 'number') {
      // re-roll initiative
      return;
    }
  }
  let worldActor = actor.isToken ? actor.token?.baseActor : actor;
  for (const combatant of game.combat.combatants.values()) {
    if (typeof combatant.initiative !== 'number') {
      continue;
    }
    if (combatant.token?.baseActor.uuid === worldActor.uuid) {
      rollData.options.fixed = combatant.initiative;
      return;
    }
  }
})

const cache = Symbol('shared-npc-initiative cache')

/** 
 * @param {Combatant} combatant
 * @param {() => Roll} rollCb
 * @returns {Roll}
 */
function initiativeRoll(combatant, rollCb) {
  if (typeof combatant.initiative === 'number') {
    // re-roll initiative
    return rollCb();
  }
  combatant.combat[cache] ??= {};
  
  const baseUuid = combatant.token?.baseActor.uuid;
  if (!baseUuid) {
    // placeholder combatants, maybe also other usecases?
    return rollCb();
  }
  for (const c of combatant.combat.combatants.values()) {
    if (typeof c.initiative !== 'number') {
      continue;
    }
    if (c.token?.baseActor.uuid === baseUuid) {
      // Purely visual so the user doesn't think the roll happened twice
      // Can't rely on it though as this sync function can be called before the first async roll resolved
      // This method is also persistent
      return new Roll(`${c.initiative}`);
    }
  }

  // Account for initiativeRoll calls happening before the first was resolved
  if (!combatant.combat[cache][baseUuid]) {
    combatant.combat[cache][baseUuid] = rollCb();
    /** @type {Function} */
    const evaluate = combatant.combat[cache][baseUuid].evaluate;
    let firstResponse;
    combatant.combat[cache][baseUuid].evaluate = function(...args) {
      if (!firstResponse) {
        firstResponse = evaluate.call(this, args);
      }
      return firstResponse;
    }
  }
  /** @type {Roll} */
  const roll = combatant.combat[cache][baseUuid];
  return roll;
}

Hooks.on('init', () => {
  /** @type {Function} */
  const originalFetInitiativeRoll = CONFIG.Combatant.documentClass.prototype.getInitiativeRoll;
  /** @this {Combatant} */
  CONFIG.Combatant.documentClass.prototype.getInitiativeRoll = function(...args) {
    if (this.actor?.type !== 'npc') {
      return originalFetInitiativeRoll.call(this, ...args)
    }
    return initiativeRoll(this, () => originalFetInitiativeRoll.call(this, ...args));
  }
})