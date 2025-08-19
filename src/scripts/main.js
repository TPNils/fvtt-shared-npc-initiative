const MODULE = `shared-npc-initiative`;

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
  if (game.combat.getFlag(MODULE, 'disabled') ?? false) {
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

//#region Toggle shared initiative UI
Hooks.on('renderCombatTracker', (combatTracker, /**@type {HTMLElement}*/htmlElement, data, arg3) => {
  const isDisabled = game.combat.getFlag(MODULE, 'disabled') ?? false;
  const toggleContainer = document.createElement(`div`);
  const toggleLabel = document.createElement('label');
  const toggleInput = document.createElement('input');
  toggleInput.setAttribute('type', 'checkbox');
  if (!isDisabled) {
    toggleInput.setAttribute('checked', '');
  }
  const combatId = game.combat.id;
  toggleInput.addEventListener('change', async () => {
    const combat = game.combats.get(combatId);
    if (!combat) {
      return;
    }
    toggleInput.disabled = true;
    await combat.setFlag(MODULE, 'disabled', !toggleInput.checked);
    toggleInput.disabled = false;
  })
  let label;
  if (game.i18n.has(`TYPES.Actor.group`) && game.i18n.has(`DND5E.NPC.Label`)) {
    label = `${game.i18n.format(`TYPES.Actor.group`)} ${game.i18n.format(`DND5E.NPC.Label`)}`;
  } else {
    label = `Group NPC`;
  }
  toggleLabel.append(label, toggleInput)
  toggleContainer.append(toggleLabel);

  const htmlHeader = htmlElement.querySelector(`.combat-tracker-header`);
  htmlHeader.append(toggleContainer);
})
//#endregion 

const cache = Symbol('shared-npc-initiative cache')

/** 
 * @param {Combatant} combatant
 * @param {() => Roll} rollCb
 * @returns {Roll}
 */
function initiativeRoll(combatant, rollCb) {
  if (combatant.combat.getFlag(MODULE, 'disabled') ?? false) {
    // disabled
    return rollCb();
  }
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