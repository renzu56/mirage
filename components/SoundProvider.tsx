"use client";

import React, { createContext, useContext, useEffect, useMemo, useState } from "react";

type SoundCtx = {
  soundOn: boolean;
  /**
   * Autoplay with sound is commonly blocked until the user interacts once.
   * Track that so you only need a single tap per session (not per video).
   */
  audioUnlocked: boolean;
  /** Set sound preference (persists to localStorage). */
  setSoundOn: (on: boolean) => void;
  /** Unlock audio for this session (no persistence). */
  unlockAudio: () => void;
  /** Convenience toggle: flips preference + unlocks audio. */
  toggleSound: () => void;
};

const Ctx = createContext<SoundCtx | null>(null);

/**
 * Persisted global sound state.
 * After the first user tap, we remember it in localStorage so EVERY video can start unmuted.
 */
export function SoundProvider({ children }: { children: React.ReactNode }) {
  const [soundOn, setSoundOn] = useState(false);
  const [audioUnlocked, setAudioUnlocked] = useState(false);

  useEffect(() => {
    try {
      const saved = localStorage.getItem("soundOn");
      if (saved === "1") setSoundOn(true);
    } catch {
      // ignore
    }
  }, []);

  const persist = (on: boolean) => {
    try {
      localStorage.setItem("soundOn", on ? "1" : "0");
    } catch {
      // ignore
    }
  };

  const setSoundOnAndPersist = (on: boolean) => {
    setSoundOn(on);
    persist(on);
  };

  const unlockAudio = () => setAudioUnlocked(true);

  const toggleSound = () => {
    // Any explicit sound toggle implies a user gesture.
    setAudioUnlocked(true);
    setSoundOnAndPersist(!soundOn);
  };

  const value = useMemo(
    () => ({
      soundOn,
      audioUnlocked,
      setSoundOn: (on: boolean) => {
        if (on) setAudioUnlocked(true);
        setSoundOnAndPersist(on);
      },
      unlockAudio,
      toggleSound,
    }),
    [soundOn, audioUnlocked]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useSound() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useSound must be used inside <SoundProvider />");
  return v;
}
