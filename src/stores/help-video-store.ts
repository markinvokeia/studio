import { create } from 'zustand';

import { getHelpVideos } from '@/services/help-assistant';

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

/**
 * Videos publicados por guía (GET help/videos), uno por idioma de la app: la ficha de
 * la pantalla ofrece "Ver video" junto a "Guiarme". Se pide una vez por idioma; si
 * falla, las guías se muestran sin video.
 */
type HelpVideoListStore = {
  byLocale: Record<string, Record<string, HelpVideo>>;
  load: (locale: string) => void;
};

const pending = new Set<string>();

export const useHelpVideoList = create<HelpVideoListStore>((set, get) => ({
  byLocale: {},
  load: (locale) => {
    if (get().byLocale[locale] || pending.has(locale)) return;
    pending.add(locale);
    getHelpVideos(locale)
      .then((videos) => set((s) => ({ byLocale: { ...s.byLocale, [locale]: Object.fromEntries(videos.map((v) => [v.useCaseId, v])) } })))
      .catch(() => { /* sin el flujo, sin videos en la ficha */ })
      .finally(() => pending.delete(locale));
  },
}));
