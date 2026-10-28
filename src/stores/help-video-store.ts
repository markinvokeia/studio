import { create } from 'zustand';

import type { HelpVideo } from '@/lib/types';

/** Reproductor flotante de videos de guías (src/components/help/help-video-player.tsx). */
type HelpVideoStore = {
  video: HelpVideo | null;
  open: (video: HelpVideo) => void;
  close: () => void;
};

export const useHelpVideo = create<HelpVideoStore>((set) => ({
  video: null,
  open: (video) => set({ video }),
  close: () => set({ video: null }),
}));
