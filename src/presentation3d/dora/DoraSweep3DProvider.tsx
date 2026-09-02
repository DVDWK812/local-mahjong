import { useFrame, useThree } from '@react-three/fiber';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { DemandFrameInvalidator } from '../animation/DemandFrameInvalidator';
import {
  DoraSweep3DController,
  DoraSweep3DDeadlineScheduler,
  type DoraSweep3DDeadlineResult,
  type DoraSweep3DSnapshot,
  type DoraSweep3DTarget,
  type DoraSweep3DTrigger,
} from './DoraSweep3DController';

export type DoraSweep3DRegistration = Readonly<{
  target: DoraSweep3DTarget;
  setSweep: (snapshot: DoraSweep3DSnapshot | null) => void;
}>;

type DoraSweep3DRegistry = Readonly<{
  register: (key: string, registration: DoraSweep3DRegistration) => () => void;
}>;

const DoraSweep3DContext = createContext<DoraSweep3DRegistry | null>(null);

export function DoraSweep3DProvider({
  children,
  trigger,
  sessionKey,
  onActiveCountChange,
  onPulseStart,
  onPulseComplete,
}: Readonly<{
  children: ReactNode;
  trigger: DoraSweep3DTrigger | null;
  sessionKey: string;
  onActiveCountChange?: (activeCount: number) => void;
  onPulseStart?: (result: Readonly<{ startTime: number; targetCount: number }>) => void;
  onPulseComplete?: (result: Readonly<{ durationMs: number; frameCount: number }>) => void;
}>) {
  const invalidate = useThree((state) => state.invalidate);
  const controllerRef = useRef(new DoraSweep3DController());
  const registrationsRef = useRef(new Map<string, Set<DoraSweep3DRegistration>>());
  const pendingRemovalTokensRef = useRef(new Map<string, symbol>());
  const seenEventIdsRef = useRef(new Set<string>());
  const pendingTriggerRef = useRef(trigger);
  const pulseStartTimeRef = useRef(0);
  const pulseFrameCountRef = useRef(0);
  const sessionInitializedRef = useRef(false);
  const deadlineHandlerRef = useRef<(result: DoraSweep3DDeadlineResult) => void>(() => undefined);
  const schedulerRef = useRef<DoraSweep3DDeadlineScheduler | null>(null);
  if (!schedulerRef.current) {
    schedulerRef.current = new DoraSweep3DDeadlineScheduler(
      controllerRef.current,
      (result) => deadlineHandlerRef.current(result),
    );
  }
  pendingTriggerRef.current = trigger;
  const [driverActive, setDriverActive] = useState(false);

  const applyControllerState = useCallback(() => {
    registrationsRef.current.forEach((registrations, key) => {
      const snapshot = controllerRef.current.get(key);
      registrations.forEach((registration) => registration.setSweep(snapshot));
    });
  }, []);

  const reportActiveCount = useCallback(() => {
    onActiveCountChange?.(controllerRef.current.activeCount);
  }, [onActiveCountChange]);

  const startActiveWindow = useCallback((
    startTime: number,
    activeCountBefore: number,
    targetCount: number,
  ) => {
    if (targetCount === 0) return;
    if (activeCountBefore === 0) {
      pulseStartTimeRef.current = startTime;
      pulseFrameCountRef.current = 0;
    }
    applyControllerState();
    reportActiveCount();
    setDriverActive(true);
    onPulseStart?.({ startTime, targetCount });
    invalidate();
  }, [applyControllerState, invalidate, onPulseStart, reportActiveCount]);

  deadlineHandlerRef.current = (result) => {
    startActiveWindow(result.startTime, result.activeCountBefore, result.startedCount);
  };

  const register = useCallback((key: string, registration: DoraSweep3DRegistration) => {
    pendingRemovalTokensRef.current.delete(key);
    const registrations = registrationsRef.current.get(key) ?? new Set();
    const firstRegistration = registrations.size === 0;
    registrations.add(registration);
    registrationsRef.current.set(key, registrations);
    if (firstRegistration) {
      const now = performance.now();
      const wasAlreadyVisible = controllerRef.current.hasVisible(key);
      const pendingEventWillTrigger = Boolean(
        pendingTriggerRef.current
        && !seenEventIdsRef.current.has(pendingTriggerRef.current.eventId)
        && pendingTriggerRef.current.targets.some((target) => target.key === key),
      );
      const activeCountBefore = controllerRef.current.activeCount;
      controllerRef.current.registerVisible(
        { ...registration.target, key },
        now,
        !pendingEventWillTrigger,
      );
      if (!pendingEventWillTrigger && !wasAlreadyVisible) {
        startActiveWindow(now, activeCountBefore, 1);
      }
      schedulerRef.current?.arm();
    }
    registration.setSweep(controllerRef.current.get(key));
    return () => {
      registration.setSweep(null);
      registrations.delete(registration);
      if (registrations.size === 0) {
        const removalToken = Symbol(key);
        pendingRemovalTokensRef.current.set(key, removalToken);
        queueMicrotask(() => {
          if (pendingRemovalTokensRef.current.get(key) !== removalToken) return;
          pendingRemovalTokensRef.current.delete(key);
          if ((registrationsRef.current.get(key)?.size ?? 0) > 0) return;
          registrationsRef.current.delete(key);
          controllerRef.current.unregisterVisible(key);
          applyControllerState();
          reportActiveCount();
          if (controllerRef.current.activeCount === 0) setDriverActive(false);
          schedulerRef.current?.arm();
        });
      }
    };
  }, [applyControllerState, reportActiveCount, startActiveWindow]);

  useEffect(() => {
    if (!sessionInitializedRef.current) {
      sessionInitializedRef.current = true;
      return;
    }
    schedulerRef.current?.cancel();
    seenEventIdsRef.current.clear();
    controllerRef.current.clear();
    const now = performance.now();
    let immediateCount = 0;
    registrationsRef.current.forEach((registrations, key) => {
      const registration = registrations.values().next().value;
      if (!registration) return;
      const pendingEventWillTrigger = Boolean(
        pendingTriggerRef.current?.targets.some((target) => target.key === key),
      );
      controllerRef.current.registerVisible(
        { ...registration.target, key },
        now,
        !pendingEventWillTrigger,
      );
      if (!pendingEventWillTrigger) immediateCount += 1;
    });
    applyControllerState();
    reportActiveCount();
    setDriverActive(false);
    if (immediateCount > 0) startActiveWindow(now, 0, immediateCount);
    schedulerRef.current?.arm();
  }, [applyControllerState, reportActiveCount, sessionKey, startActiveWindow]);

  useEffect(() => {
    if (!trigger || seenEventIdsRef.current.has(trigger.eventId)) return;
    const targets = trigger.targets.filter((target) => registrationsRef.current.has(target.key));
    if (targets.length === 0) return;
    seenEventIdsRef.current.add(trigger.eventId);
    trimSeenEvents(seenEventIdsRef.current);
    const inactiveTargets = targets.filter((target) => controllerRef.current.get(target.key) === null);
    if (inactiveTargets.length === 0) {
      schedulerRef.current?.arm();
      return;
    }
    const startTime = performance.now();
    const activeCountBefore = controllerRef.current.activeCount;
    controllerRef.current.trigger({ ...trigger, targets: inactiveTargets }, startTime);
    startActiveWindow(startTime, activeCountBefore, inactiveTargets.length);
    schedulerRef.current?.arm();
  }, [startActiveWindow, trigger]);

  useEffect(() => () => {
    schedulerRef.current?.cancel();
    controllerRef.current.clear();
    registrationsRef.current.forEach((registrations) => {
      registrations.forEach((registration) => registration.setSweep(null));
    });
    registrationsRef.current.clear();
    pendingRemovalTokensRef.current.clear();
  }, []);

  const handleFrame = useCallback((now: number) => {
    pulseFrameCountRef.current += 1;
    const activeCount = controllerRef.current.advance(now);
    applyControllerState();
    if (activeCount === 0) {
      reportActiveCount();
      onPulseComplete?.({
        durationMs: now - pulseStartTimeRef.current,
        frameCount: pulseFrameCountRef.current,
      });
      setDriverActive(false);
    }
    return activeCount;
  }, [applyControllerState, onPulseComplete, reportActiveCount]);

  const registry = useMemo(() => ({ register }), [register]);
  return (
    <DoraSweep3DContext.Provider value={registry}>
      {children}
      {driverActive ? <DoraSweep3DFrameDriver onFrame={handleFrame} /> : null}
    </DoraSweep3DContext.Provider>
  );
}

export function useDoraSweep3DRegistration(
  key: string | undefined,
  registration: DoraSweep3DRegistration,
): void {
  const registry = useContext(DoraSweep3DContext);
  useLayoutEffect(() => {
    if (!registry || !key) {
      registration.setSweep(null);
      return undefined;
    }
    return registry.register(key, registration);
  }, [key, registration, registry]);
}

function DoraSweep3DFrameDriver({
  onFrame,
}: Readonly<{ onFrame: (now: number) => number }>) {
  const invalidate = useThree((state) => state.invalidate);
  const invalidatorRef = useRef(new DemandFrameInvalidator());
  const completedRef = useRef(false);

  useLayoutEffect(() => {
    invalidatorRef.current.markInvalidated(performance.now());
    invalidate();
    return () => invalidatorRef.current.cancelPending();
  }, [invalidate]);

  useFrame(() => {
    if (completedRef.current) return;
    const now = performance.now();
    invalidatorRef.current.markInvalidated(now);
    const activeCount = onFrame(now);
    if (activeCount > 0) {
      invalidatorRef.current.request(invalidate);
    } else {
      completedRef.current = true;
      invalidatorRef.current.cancelPending();
    }
  });

  return null;
}

function trimSeenEvents(events: Set<string>): void {
  while (events.size > 128) {
    const oldest = events.values().next().value;
    if (oldest === undefined) return;
    events.delete(oldest);
  }
}
