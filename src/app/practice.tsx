import { router, useLocalSearchParams } from 'expo-router';
import { JourneyCalendar } from '@/ui/journey-calendar';
import { JourneyScreen } from '@/ui/journey-screen';

export default function Journey() {
  const { view } = useLocalSearchParams<{ view?: string }>();
  return view === 'levels'
    ? <JourneyScreen onShowCalendar={() => router.setParams({ view: 'calendar' })} />
    : <JourneyCalendar onShowProgress={() => router.setParams({ view: 'levels' })} />;
}
