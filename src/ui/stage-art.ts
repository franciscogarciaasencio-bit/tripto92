import type { ImageSourcePropType } from 'react-native';
import { getSealedStageArt, isSealedStage } from './category-presentation';

/**
 * Watercolour stage paintings. Visible stages are ordinary bundled images (static requires for
 * Metro); sealed stages are unveiled in memory from the sealed data and never exist as image files.
 * Null means the stage has no painting yet and its line symbol is shown instead.
 */
const VISIBLE: Readonly<Record<string, ImageSourcePropType>> = {
  monkey_mind: require('../../assets/ona/stages/monkey_mind.png'),
  rooted_habit: require('../../assets/ona/stages/rooted_habit.png'),
  integrated_practice: require('../../assets/ona/stages/integrated_practice.png'),
  everyday_presence: require('../../assets/ona/stages/everyday_presence.png'),
  natural_stillness: require('../../assets/ona/stages/natural_stillness.png'),
  steady_presence: require('../../assets/ona/stages/steady_presence.png'),
};

export function getStageArt(id: string): ImageSourcePropType | null {
  if (isSealedStage(id)) {
    const uri = getSealedStageArt(id);
    return uri ? { uri } : null;
  }
  return VISIBLE[id] ?? null;
}
