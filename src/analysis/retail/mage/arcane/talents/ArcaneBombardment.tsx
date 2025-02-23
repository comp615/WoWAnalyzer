import TALENTS from 'common/TALENTS/mage';
import Analyzer, { Options } from 'parser/core/Analyzer';
import { calculateEffectiveDamage } from 'parser/core/EventCalculateLib';
import { SELECTED_PLAYER } from 'parser/core/EventFilter';
import Events, { DamageEvent } from 'parser/core/Events';
import AbilityTracker from 'parser/shared/modules/AbilityTracker';
import BoringSpellValueText from 'parser/ui/BoringSpellValueText';
import ItemDamageDone from 'parser/ui/ItemDamageDone';
import Statistic from 'parser/ui/Statistic';
import STATISTIC_CATEGORY from 'parser/ui/STATISTIC_CATEGORY';

const HEALTH_THRESHOLD = 0.35;
const DAMAGE_BONUS = 0.8;

class ArcaneBombardment extends Analyzer {
  static dependencies = {
    abilityTracker: AbilityTracker,
  };
  protected abilityTracker!: AbilityTracker;

  bonusDamage = 0;

  constructor(options: Options) {
    super(options);
    this.active = false;
    this.addEventListener(
      Events.damage.by(SELECTED_PLAYER).spell(TALENTS.ARCANE_BARRAGE_TALENT),
      this.onBarrageDamage,
    );
  }

  onBarrageDamage(event: DamageEvent) {
    if (!event.hitPoints || !event.maxHitPoints) {
      return;
    }
    const enemyHealth = event.hitPoints / event.maxHitPoints;
    if (enemyHealth <= HEALTH_THRESHOLD) {
      this.bonusDamage += calculateEffectiveDamage(event, DAMAGE_BONUS);
    }
  }

  statistic() {
    return (
      <Statistic category={STATISTIC_CATEGORY.ITEMS} size="flexible">
        <BoringSpellValueText spellId={TALENTS.ARCANE_BOMBARDMENT_TALENT.id}>
          <ItemDamageDone amount={this.bonusDamage} />
          <br />
        </BoringSpellValueText>
      </Statistic>
    );
  }
}

export default ArcaneBombardment;
