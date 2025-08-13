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

const cache = Symbol('shared-npc-initiative cache')

/** 
 * @param {Combatant} combatant
 * @param {() => Roll} rollCb
 * @returns {Roll}
 */
function initiativeRoll(combatant, rollCb) {
  combatant.combat[cache] ??= {};
  const baseUuid = combatant.token?.baseActor.uuid;
  if (!baseUuid) {
    // placeholder combatants, maybe also other usecases?
    return rollCb();
  }
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
  if (roll._evaluated) {
    // Purely visual so the user doesn't think the roll happened twice
    // Can't rely on it though as this sync function can be called before the first async roll resolved
    return new Roll(`${roll.total}`);
  }
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