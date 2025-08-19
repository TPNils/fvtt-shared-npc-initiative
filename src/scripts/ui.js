import { MODULE } from "./const.js";

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