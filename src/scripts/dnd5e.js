import { MODULE } from "./const.js";

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
  if (game.combat?.getFlag(MODULE, 'disabled') ?? false) {
    // disabled
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