import { createInitialReplayState, reduceGameEvent } from './eventReducer';
import type { GameEvent, MatchLog, ReplayController, ReplaySnapshot, ReplayState } from './types';

export interface Replay {
  log: MatchLog;
  events: GameEvent[];
  controller: ReplayController;
  state: ReplayState;
  snapshots: ReplaySnapshot[];
}

export function createReplay(log: MatchLog): Replay {
  const events = log.rounds.flatMap((round) => round.events).sort((a, b) => a.sequence - b.sequence);
  return {
    log,
    events,
    controller: { status: 'paused', currentEventIndex: -1, speed: 1 },
    state: createInitialReplayState(log),
    snapshots: [],
  };
}

export function stepForward(replay: Replay): Replay {
  const nextIndex = replay.controller.currentEventIndex + 1;
  if (nextIndex >= replay.events.length) return { ...replay, controller: { ...replay.controller, status: 'ended' } };
  const state = reduceGameEvent(replay.state, replay.events[nextIndex]);
  const snapshots = nextIndex % 20 === 0 ? [...replay.snapshots, { eventIndex: nextIndex, state }] : replay.snapshots;
  return {
    ...replay,
    state,
    snapshots,
    controller: {
      ...replay.controller,
      currentEventIndex: nextIndex,
      status: nextIndex === replay.events.length - 1 ? 'ended' : replay.controller.status,
    },
  };
}

export function stepBackward(replay: Replay): Replay {
  return seekToEvent(replay, replay.controller.currentEventIndex - 1);
}

export function seekToEvent(replay: Replay, eventIndex: number): Replay {
  const target = Math.max(-1, Math.min(eventIndex, replay.events.length - 1));
  let state = createInitialReplayState(replay.log);
  for (let index = 0; index <= target; index += 1) {
    state = reduceGameEvent(state, replay.events[index]);
  }
  return {
    ...replay,
    state,
    controller: {
      ...replay.controller,
      currentEventIndex: target,
      status: target === replay.events.length - 1 ? 'ended' : 'paused',
    },
  };
}

export function play(replay: Replay): Replay {
  return { ...replay, controller: { ...replay.controller, status: replay.controller.currentEventIndex >= replay.events.length - 1 ? 'ended' : 'playing' } };
}

export function pause(replay: Replay): Replay {
  return { ...replay, controller: { ...replay.controller, status: 'paused' } };
}

export function setPlaybackSpeed(replay: Replay, speed: ReplayController['speed']): Replay {
  return { ...replay, controller: { ...replay.controller, speed } };
}
