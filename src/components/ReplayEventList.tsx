import type { GameEvent } from '../game/replay/types';

interface ReplayEventListProps {
  events: GameEvent[];
  currentEventIndex: number;
  onSelect: (index: number) => void;
}

export function ReplayEventList({ events, currentEventIndex, onSelect }: ReplayEventListProps) {
  return (
    <ol className="replay-event-list">
      {events.map((event, index) => (
        <li key={event.eventId} className={index === currentEventIndex ? 'replay-event--active' : ''}>
          <button type="button" onClick={() => onSelect(index)}>{event.sequence}. {event.type}</button>
        </li>
      ))}
    </ol>
  );
}
