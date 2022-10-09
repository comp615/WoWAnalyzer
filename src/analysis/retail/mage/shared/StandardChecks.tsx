import Analyzer from 'parser/core/Analyzer';
import CASTS_THAT_ARENT_CASTS from 'parser/core/CASTS_THAT_ARENT_CASTS';
import { SpellInfo } from 'parser/core/EventFilter';
import { EventType, CastEvent, BeginChannelEvent } from 'parser/core/Events';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import Enemies, { encodeTargetString } from 'parser/shared/modules/Enemies';
import EventHistory from 'parser/shared/modules/EventHistory';
import SpellUsable from 'parser/shared/modules/SpellUsable';

class StandardChecks extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
    spellUsable: SpellUsable,
    enemies: Enemies,
    eventHistory: EventHistory,
  };
  protected abilityTracker!: AbilityTracker;
  protected spellUsable!: SpellUsable;
  protected enemies!: Enemies;
  protected eventHistory!: EventHistory;

  /**
   * @param buff the spell object for the buff
   * @returns an array containing each unique spell cast and the number of times it was cast
   */
  castBreakdownDuringBuff(buff: SpellInfo) {
    const castEvents: any = this.getEventsDuringBuff(buff, EventType.Cast);
    const castArray: number[][] = [];
    castEvents &&
      castEvents.forEach((c: CastEvent) => {
        const index = castArray.findIndex((arr) => arr.includes(c.ability.guid));
        if (index !== -1) {
          castArray[index][1] += 1;
        } else {
          castArray.push([c.ability.guid, 1]);
        }
      });
    return castArray;
  }

  countTotalCasts(spell: SpellInfo) {
    return this.abilityTracker.getAbility(spell.id).casts;
  }

  countEventsDuringBuff(buff: SpellInfo, eventType: string, cast?: SpellInfo) {
    /**
     * @param buff the spell object for the buff
     * @param eventType the type of event that you want to search for. i.e. "cast", "begincast", EventType.Cast, EventType.BeginCast, etc.
     * @param cast an optional cast spell object to count. Omit or leave undefined to count all casts
     */
    const events = this.getEventsDuringBuff(buff, eventType, cast);
    return events.length;
  }

  /**
   * @param buff the spell object for the buff
   * @param eventType the type of event that you want to search for. i.e. "cast", "begincast", EventType.Cast, EventType.BeginCast, etc.
   * @param cast an optional cast spell object to count. Omit or leave undefined to count all casts
   */
  countEventsWithoutBuff(buff: SpellInfo, eventType: string, cast?: SpellInfo) {
    const events = this.getEventsWithoutBuff(buff, eventType, cast);
    return events.length;
  }

  /**
   * @param buff the spell object for the buff
   * @param eventType the type of event that you want to search for. i.e. "cast", "begincast", EventType.Cast, EventType.BeginCast, etc.
   * @param spell an optional spell object to search. Omit or leave undefined to count all events
   */
  getEventsDuringBuff(buff: SpellInfo, eventType: string, spell?: SpellInfo) {
    const events = this.getEvents(eventType, undefined, undefined, undefined, spell);
    const filteredEvents = events.filter(
      (e) =>
        this.selectedCombatant.hasBuff(buff.id, e.timestamp) &&
        (!spell || ('ability' in e && spell.id === e.ability.guid)),
    );
    return filteredEvents;
  }

  /**
   * @param buff the spell object for the buff
   * @param eventType the type of event that you want to search for. i.e. "cast", "begincast", EventType.Cast, EventType.BeginCast, etc.
   * @param spell an optional spell object to search. Omit or leave undefined to count all events
   */
  getEventsWithoutBuff(buff: SpellInfo, eventType: string, spell?: SpellInfo) {
    const events = this.getEvents(eventType, undefined, undefined, undefined, spell);

    const filteredEvents = events.filter(
      (e) =>
        !this.selectedCombatant.hasBuff(buff.id, e.timestamp) &&
        (!spell || ('ability' in e && spell.id === e.ability.guid)),
    );
    return filteredEvents;
  }

  getTargetHealth(castEvent: CastEvent) {
    const castTarget =
      castEvent.targetID && encodeTargetString(castEvent.targetID, castEvent.targetInstance);
    const damageEvents = this.getEvents(EventType.Damage, undefined, castEvent.timestamp, 5000);
    if (!damageEvents) {
      return;
    }

    const relevantEvent = damageEvents.find(
      (e) =>
        'targetID' in e &&
        e.targetID &&
        'targetInstance' in e &&
        e.targetInstance &&
        castTarget === encodeTargetString(e.targetID, e.targetInstance),
    );

    if (
      relevantEvent &&
      'hitPoints' in relevantEvent &&
      'maxHitPoints' in relevantEvent &&
      relevantEvent.hitPoints &&
      relevantEvent.maxHitPoints
    ) {
      return relevantEvent.hitPoints / relevantEvent.maxHitPoints;
    } else {
      return undefined;
    }
  }

  getEvents(
    eventType?: string,
    count?: number,
    startTimestamp: number = this.owner.fight.end_time,
    duration?: number,
    spell?: SpellInfo,
  ) {
    const events = this.eventHistory.last(count, duration, undefined, startTimestamp);

    const filteredEvents = events.filter((e) => {
      if ('ability' in e && spell) {
        return (
          !CASTS_THAT_ARENT_CASTS.includes(e.ability.guid) &&
          e.ability.guid === spell.id &&
          (!eventType || eventType === e.type)
        );
      } else if ('ability' in e) {
        return (
          CASTS_THAT_ARENT_CASTS.includes(e.ability.guid) && (!eventType || eventType === e.type)
        );
      } else {
        return !eventType || eventType === e.type;
      }
    });
    return filteredEvents;
  }

  highlightInefficientCast(
    event: CastEvent | BeginChannelEvent | CastEvent[] | BeginChannelEvent[],
    tooltip: string,
  ) {
    if (Array.isArray(event)) {
      event.forEach((e) => {
        e.meta = e.meta || {};
        e.meta.isInefficientCast = true;
        e.meta.inefficientCastReason = tooltip;
      });
    } else {
      event.meta = event.meta || {};
      event.meta.isInefficientCast = true;
      event.meta.inefficientCastReason = tooltip;
    }
  }

  //TODO: Modify this to use the enhanced casts stuff instead of inefficient casts
  highlightEnhancedCast(
    event: CastEvent | BeginChannelEvent | CastEvent[] | BeginChannelEvent[],
    tooltip: string,
  ) {
    if (Array.isArray(event)) {
      event.forEach((e) => {
        e.meta = e.meta || {};
        e.meta.isInefficientCast = true;
        e.meta.inefficientCastReason = tooltip;
      });
    } else {
      event.meta = event.meta || {};
      event.meta.isInefficientCast = true;
      event.meta.inefficientCastReason = tooltip;
    }
  }
}

export default StandardChecks;
