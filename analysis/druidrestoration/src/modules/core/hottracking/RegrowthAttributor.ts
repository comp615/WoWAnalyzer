import SPELLS from 'common/SPELLS';
import Analyzer, { Options, SELECTED_PLAYER } from 'parser/core/Analyzer';
import Events, { ApplyBuffEvent, CastEvent, HealEvent, RefreshBuffEvent } from 'parser/core/Events';
import { Attribution } from 'parser/shared/modules/HotTracker';

import HotTrackerRestoDruid from './HotTrackerRestoDruid';

const BUFFER_MS = 150; // saw a few cases of taking close to 150ms from cast -> applybuff
/*
 * Backend module tracks attribution of Regrowth
 * TODO - Revive this new module to use with Shadowlands attributions
 */
class RegrowthAttributor extends Analyzer {
  static dependencies = {
    hotTracker: HotTrackerRestoDruid,
  };

  protected hotTracker!: HotTrackerRestoDruid;

  // cast tracking stuff
  lastRegrowthCastTimestamp: number | undefined;
  lastRegrowthTarget: number | undefined;

  totalNonCCRegrowthHealing = 0;
  totalNonCCRegrowthOverhealing = 0;
  totalNonCCRegrowthAbsorbs = 0;
  totalNonCCRegrowthHealingTicks = 0;

  constructor(options: Options) {
    super(options);
    this.addEventListener(Events.cast.by(SELECTED_PLAYER).spell(SPELLS.REGROWTH), this.onCast);
    this.addEventListener(Events.heal.by(SELECTED_PLAYER).spell(SPELLS.REGROWTH), this.onHeal);
    this.addEventListener(
      Events.applybuff.by(SELECTED_PLAYER).spell(SPELLS.REGROWTH),
      this._getRegrowthAttribution,
    );
    this.addEventListener(
      Events.refreshbuff.by(SELECTED_PLAYER).spell(SPELLS.REGROWTH),
      this._getRegrowthAttribution,
    );
  }

  onCast(event: CastEvent) {
    const targetId = event.targetID;

    // set last cast timestamps, used for attribution of HoT applications later
    this.lastRegrowthCastTimestamp = event.timestamp;
    this.lastRegrowthTarget = targetId;
  }

  onHeal(event: HealEvent) {
    if (!this.selectedCombatant.hasBuff(SPELLS.CLEARCASTING_BUFF.id, event.timestamp, BUFFER_MS)) {
      this.totalNonCCRegrowthHealing += event.amount;
      this.totalNonCCRegrowthOverhealing += event.overheal || 0;
      this.totalNonCCRegrowthAbsorbs += event.absorbed || 0;
      if (event.tick) {
        this.totalNonCCRegrowthHealingTicks += 1;
      }
    }
  }

  // gets attribution for a given applybuff/refreshbuff of Regrowth
  _getRegrowthAttribution(event: ApplyBuffEvent | RefreshBuffEvent) {
    const spellId = event.ability.guid;
    const targetId = event.targetID;
    if (!this.hotTracker.hots[targetId] || !this.hotTracker.hots[targetId][spellId]) {
      return;
    }

    const timestamp = event.timestamp;
    const attributions: Attribution[] = [];

    if (
      event.prepull ||
      this.lastRegrowthCastTimestamp === undefined ||
      (this.lastRegrowthCastTimestamp + BUFFER_MS > timestamp &&
        this.lastRegrowthTarget === targetId)
    ) {
      // regular cast (assume prepull applications are hardcast)
      // standard hardcast gets no special attribution
    } else {
      console.warn(
        `Unable to attribute Regrowth @${this.owner.formatTimestamp(timestamp)} on ${targetId}`,
      );
    }

    attributions.forEach((att) => {
      this.hotTracker.addAttribution(att, targetId, spellId);
    });
  }
}

export default RegrowthAttributor;
