import type {
  AestheticBodyFigure,
  AestheticBodyMuscle,
  AestheticDepth,
  AestheticMapRegion,
  AestheticMapView,
  AestheticSide,
  AestheticTechnique,
  AestheticZoneBase,
  AestheticZoneId,
} from '@/lib/types';

// Face line art drawn in-house (no third-party license). It can be replaced keeping each
// template's viewBox and the zone ids.

/** Mirrors a shape across the vertical center of a template `width` units wide */
export const mirrorTransform = (width: number) => `translate(${width} 0) scale(-1 1)`;

export interface ZoneShape {
  base: AestheticZoneBase;
  d: string;
  /** Bilateral zone: the shape covers one side and the other side is its mirror */
  sided: boolean;
}

/** Decoration of a template; every shape is purely visual */
export interface TemplateArt {
  /** Main strokes (outline, features) */
  lines?: string[];
  /** Thin secondary strokes (creases, lids, anatomical contours) */
  details?: string[];
  /** Filled shapes (iris, nostrils) */
  fills?: string[];
}

export interface MapTemplate extends TemplateArt {
  width: number;
  height: number;
  /** Drawn twice, as-is and mirrored: one half of a symmetric front drawing */
  symmetric?: TemplateArt;
  /** Bottom-to-top: the last matching zone wins a hit test */
  zones: ZoneShape[];
}

/**
 * Front view. Symmetric shapes and bilateral zones are drawn on the viewer's left, which
 * is the patient's right; the patient's left is their mirror.
 */
export const FRONT_TEMPLATE: MapTemplate = {
  width: 300,
  height: 380,
  lines: [
    // Lips: cupid's bow, parting line and lower lip
    'M122,259 C132,254 141,248 150,252 C159,248 168,254 178,259',
    'M122,259 C136,264 164,264 178,259',
    'M126,263 C136,276 164,276 174,263',
    // Columella
    'M144,231 C147,234 153,234 156,231',
  ],
  details: [
    // Chin crease
    'M138,292 C145,296 155,296 162,292',
  ],
  symmetric: {
    lines: [
      // Head outline from the crown to the chin
      'M150,26 C106,26 70,56 64,114 C61,144 63,170 67,192 C71,216 75,238 83,258 C92,280 108,300 126,312 C135,318 143,321 150,321',
      // Ear
      'M66,168 C56,158 45,166 47,186 C49,206 56,222 66,230 C70,233 74,231 75,226',
      // Neck and the start of the shoulders
      'M100,288 C103,320 100,350 90,372 C82,376 70,378 56,380',
      // Brow
      'M84,150 C96,140 116,138 136,146',
      // Eye
      'M133,174 C124,165 106,163 95,172 C106,181 124,182 133,174 Z',
      // Nose wing
      'M136,212 C127,216 125,229 134,232 C138,234 141,233 144,231',
    ],
    details: [
      // Ear rim
      'M60,178 C54,184 55,200 61,212',
      // Upper lid crease and lower lid
      'M131,166 C121,157 104,157 94,166',
      'M128,182 C118,187 106,186 99,180',
      // Side of the nasal bridge
      'M140,176 C141,192 140,204 136,212',
      // Philtrum
      'M146,234 L145,249',
      // Cheekbone, nasolabial fold and marionette line
      'M76,204 C88,196 104,196 116,202',
      'M128,222 C119,234 116,248 119,262',
      'M121,268 C118,278 117,288 119,296',
      // Sternocleidomastoid
      'M98,300 C110,320 124,342 136,364',
    ],
    fills: [
      // Iris and nostril
      'M114,172 m-6,0 a6,6 0 1,0 12,0 a6,6 0 1,0 -12,0',
      'M137,228 C139,225 144,225 146,228 C144,231 139,231 137,228 Z',
    ],
  },
  zones: [
    { base: 'neck', sided: false, d: 'M100,290 C114,306 132,322 150,324 C168,322 186,306 200,290 C202,320 204,350 210,380 L90,380 C96,350 98,320 100,290 Z' },
    { base: 'forehead', sided: false, d: 'M150,48 C124,48 100,58 88,80 C82,98 82,120 86,140 C104,134 122,136 138,143 L150,146 L162,143 C178,136 196,134 214,140 C218,120 218,98 212,80 C200,58 176,48 150,48 Z' },
    { base: 'temple', sided: true, d: 'M86,82 C76,96 70,114 68,134 C67,148 68,160 70,168 L90,166 C88,158 86,152 85,144 C82,124 82,102 86,82 Z' },
    { base: 'cheek', sided: true, d: 'M76,200 C86,195 94,193 100,192 C111,198 124,198 134,192 L134,212 C124,224 106,232 90,234 C83,224 79,212 76,200 Z' },
    { base: 'jawline', sided: true, d: 'M82,256 C91,278 107,298 125,310 C131,314 136,316 141,318 L141,309 C131,305 119,297 110,288 C100,278 94,266 90,253 Z' },
    { base: 'masseter', sided: true, d: 'M80,228 C90,226 100,230 107,237 C111,252 111,268 105,283 C97,276 90,267 86,257 C82,247 80,238 80,228 Z' },
    { base: 'glabella', sided: false, d: 'M138,145 C144,143 156,143 162,145 L160,166 C154,170 146,170 140,166 Z' },
    { base: 'crowsFeet', sided: true, d: 'M94,162 L74,158 C71,170 72,182 76,195 L94,186 C90,179 90,170 94,162 Z' },
    { base: 'tearTrough', sided: true, d: 'M132,181 C124,187 110,189 100,185 L98,193 C110,199 126,197 135,190 Z' },
    { base: 'nose', sided: false, d: 'M142,168 C140,184 140,200 136,212 C127,216 125,229 134,232 C140,236 146,236 150,236 C154,236 160,236 166,232 C175,229 173,216 164,212 C160,200 160,184 158,168 Z' },
    { base: 'nasolabial', sided: true, d: 'M128,219 C118,233 114,249 117,264 L127,259 C125,248 129,236 137,227 Z' },
    { base: 'upperLip', sided: false, d: 'M134,236 C140,239 146,240 150,240 C154,240 160,239 166,236 C172,243 176,251 178,259 C168,254 159,248 150,252 C141,248 132,254 122,259 C124,251 128,243 134,236 Z' },
    { base: 'lowerLip', sided: false, d: 'M122,259 C136,264 164,264 178,259 C172,272 160,278 150,278 C140,278 128,272 122,259 Z' },
    { base: 'marionette', sided: true, d: 'M120,265 C116,276 114,287 116,298 L127,299 C126,288 128,278 131,268 Z' },
    { base: 'chin', sided: false, d: 'M130,283 C140,280 160,280 170,283 C176,292 176,304 172,312 C164,318 156,321 150,321 C144,321 136,318 128,312 C124,304 124,292 130,283 Z' },
  ],
};

/** Profile showing the patient's right side (nose towards the viewer's right). */
export const PROFILE_TEMPLATE: MapTemplate = {
  width: 300,
  height: 380,
  lines: [
    // Face: forehead, brow ridge, nose, lips and chin, then the chin's underside and the neck
    'M150,26 C196,26 224,62 226,108 C227,124 226,138 228,150 C226,158 222,162 220,168 C226,184 240,200 252,212 C256,218 250,224 240,226 C236,228 232,230 230,232 C234,238 238,244 236,252 C232,256 228,258 226,260 C232,262 236,266 234,272 C230,278 224,282 222,284 C228,290 234,298 232,308 C228,318 220,324 206,326 C198,326 192,325 186,322 C194,342 198,360 200,380',
    // Back of the head and the nape
    'M150,26 C96,26 60,66 56,128 C52,184 66,228 92,262 C96,300 96,340 92,380',
    // Ear
    'M118,172 C106,168 100,186 102,204 C104,222 112,236 124,236 C132,236 134,228 130,220 C128,206 130,188 132,178 C130,172 124,170 118,172 Z',
    // Brow
    'M194,146 C204,140 216,140 225,146',
    // Eye
    'M205,167 C211,160 219,160 224,166 C218,173 210,173 205,167 Z',
    // Nose wing
    'M240,214 C230,210 224,220 230,226 C233,228 237,227 240,225',
  ],
  details: [
    // Ear rim and lids
    'M112,186 C108,196 110,214 118,222',
    'M206,160 C212,154 220,154 225,159',
    // Mouth corner
    'M226,260 L216,261',
    // Jaw border up to the ear, cheekbone and nasolabial fold
    'M186,322 C170,316 152,306 140,292 C134,284 132,272 132,250',
    'M174,196 C188,190 204,190 218,194',
    'M224,226 C214,238 210,250 212,264',
    // Hairline and sideburn
    'M206,58 C176,48 140,56 118,76 C102,92 98,112 100,130 C102,146 106,158 112,166',
    // Sternocleidomastoid
    'M110,262 C130,290 156,330 176,380',
  ],
  fills: [
    // Iris and nostril
    'M219,166 m-4,0 a4,4 0 1,0 8,0 a4,4 0 1,0 -8,0',
    'M232,221 C234,218 238,218 240,221 C238,223 234,223 232,221 Z',
  ],
  zones: [
    { base: 'neck', sided: false, d: 'M92,264 C110,286 130,300 150,310 C166,318 180,324 190,326 C194,344 198,362 200,380 L92,380 C96,340 96,300 92,264 Z' },
    { base: 'forehead', sided: false, d: 'M184,52 C206,58 220,78 224,104 C226,120 226,134 226,146 C212,140 196,140 184,146 C182,124 178,96 170,74 C172,64 176,56 184,52 Z' },
    { base: 'temple', sided: true, d: 'M136,96 C152,90 168,96 176,108 C181,122 182,138 182,152 L158,157 C150,145 143,128 138,112 Z' },
    { base: 'cheek', sided: true, d: 'M184,190 C198,184 214,186 228,192 C232,200 233,208 230,215 C224,221 220,228 216,235 C200,237 184,231 170,221 C170,209 175,197 184,190 Z' },
    { base: 'masseter', sided: true, d: 'M140,236 C156,232 172,238 180,248 C184,262 184,276 180,290 C166,290 150,282 142,270 C136,260 136,246 140,236 Z' },
    { base: 'jawline', sided: true, d: 'M132,262 C134,278 144,294 162,306 C174,314 186,320 198,324 L201,316 C187,312 173,306 163,298 C151,288 143,276 140,262 Z' },
    { base: 'crowsFeet', sided: true, d: 'M201,156 L184,154 C178,164 178,176 182,187 L201,178 C198,172 198,162 201,156 Z' },
    { base: 'tearTrough', sided: true, d: 'M206,174 C213,178 221,178 226,174 L228,186 C220,190 210,190 204,186 Z' },
    { base: 'nose', sided: false, d: 'M220,168 C226,184 240,200 252,212 C256,218 250,224 240,226 C234,228 230,230 228,230 C228,222 226,212 224,206 C222,190 220,178 220,168 Z' },
    { base: 'nasolabial', sided: true, d: 'M222,227 C212,238 208,251 210,265 L218,263 C216,251 219,240 227,231 Z' },
    { base: 'upperLip', sided: false, d: 'M229,232 C234,238 238,244 236,252 C232,256 228,258 226,260 C222,252 222,240 229,232 Z' },
    { base: 'lowerLip', sided: false, d: 'M226,260 C232,262 236,266 234,272 C230,278 224,282 222,284 C220,276 220,268 226,260 Z' },
    { base: 'marionette', sided: true, d: 'M212,267 C208,278 208,289 212,299 L220,297 C218,287 218,277 220,269 Z' },
    { base: 'chin', sided: false, d: 'M222,284 C228,290 234,298 232,308 C228,318 220,324 206,326 C200,316 200,300 206,290 C212,286 218,284 222,284 Z' },
  ],
};

// ──── Views ────

type FaceView = Extract<AestheticMapView, 'front' | 'left' | 'right'>;
type BodyView = Extract<AestheticMapView, 'bodyFront' | 'bodyBack'>;

export const VIEW_REGION: Record<AestheticMapView, AestheticMapRegion> = {
  front: 'face',
  left: 'face',
  right: 'face',
  bodyFront: 'body',
  bodyBack: 'body',
};

export const isFaceView = (view: AestheticMapView): view is FaceView => VIEW_REGION[view] === 'face';

type ViewSides =
  /** Both sides on screen: shapes are drawn as `drawn`, their mirror is the other side */
  | { kind: 'bilateral'; drawn: AestheticSide }
  /** A profile: every bilateral zone belongs to this side */
  | { kind: 'single'; side: AestheticSide };

interface FaceViewConfig {
  template: MapTemplate;
  /** The whole drawing is mirrored (the left profile reuses the right one) */
  mirrored: boolean;
  sides: ViewSides;
}

const FACE_VIEW_CONFIGS: Record<FaceView, FaceViewConfig> = {
  front: { template: FRONT_TEMPLATE, mirrored: false, sides: { kind: 'bilateral', drawn: 'right' } },
  left: { template: PROFILE_TEMPLATE, mirrored: true, sides: { kind: 'single', side: 'left' } },
  right: { template: PROFILE_TEMPLATE, mirrored: false, sides: { kind: 'single', side: 'right' } },
};

interface RenderedZone {
  id: AestheticZoneId;
  d: string;
  mirrored: boolean;
}

const otherSide = (side: AestheticSide): AestheticSide => (side === 'left' ? 'right' : 'left');

/** Face zones as they are drawn, with each bilateral zone resolved to the patient's side */
function getFaceZones(view: FaceView): RenderedZone[] {
  const { template, mirrored, sides } = FACE_VIEW_CONFIGS[view];
  return template.zones.flatMap((zone): RenderedZone[] => {
    const { base, d } = zone;
    if (!zone.sided) return [{ id: base, d, mirrored }];
    if (sides.kind === 'single') return [{ id: `${base}.${sides.side}`, d, mirrored }];
    return [
      { id: `${base}.${sides.drawn}`, d, mirrored: false },
      { id: `${base}.${otherSide(sides.drawn)}`, d, mirrored: true },
    ];
  });
}

/** Open Muscle Map muscles drawn in each body view (the same for both figures) */
export const BODY_VIEW_MUSCLES: Record<BodyView, AestheticBodyMuscle[]> = {
  bodyFront: [
    'sternocleidomastoid', 'trapezius', 'anterior_deltoid', 'lateral_deltoid', 'pectoralis_major', 'biceps_brachii',
    'brachialis', 'serratus_anterior', 'rectus_abdominis', 'external_oblique', 'forearm_flexors', 'tensor_fasciae_latae',
    'iliopsoas', 'hip_adductors', 'sartorius', 'rectus_femoris', 'vastus_lateralis', 'vastus_medialis', 'patella_region',
    'patellar_tendon_region', 'tibialis_anterior', 'gastrocnemius', 'fibularis_group', 'soleus',
  ],
  bodyBack: [
    'trapezius', 'lateral_deltoid', 'posterior_deltoid', 'posterior_rotator_cuff', 'triceps_brachii', 'latissimus_dorsi',
    'external_oblique', 'erector_spinae', 'forearm_extensors', 'gluteus_medius', 'gluteus_maximus', 'hip_adductors',
    'iliotibial_tract', 'biceps_femoris', 'medial_hamstrings', 'popliteal_region', 'gastrocnemius', 'soleus', 'achilles_tendon',
  ],
};

/** Every zone a view can hold: for pickers and to find which view draws a zone */
export function getViewZoneIds(view: AestheticMapView): AestheticZoneId[] {
  if (isFaceView(view)) return [...new Set(getFaceZones(view).map((z) => z.id))];
  return BODY_VIEW_MUSCLES[view].flatMap((muscle): AestheticZoneId[] => [`${muscle}.right`, `${muscle}.left`]);
}

export function parseZoneId(zone: AestheticZoneId): { base: AestheticZoneBase; side?: AestheticSide } {
  const [base, side] = zone.split('.') as [AestheticZoneBase, AestheticSide | undefined];
  return { base, side };
}

// ──── Artwork ────
// What the map draws for a view, in one style for face and body: line art (the outline
// and, on the face, its features) over transparent zones with a dashed border.

export interface ArtworkShape {
  key: string;
  d: string;
  transform?: string;
}

export interface ArtworkZone extends ArtworkShape {
  zone: AestheticZoneId;
  /** Structure that is not a muscle (kneecap, tendon...): drawn muted, still a zone */
  inert: boolean;
}

export interface MapArtwork {
  viewBox: { x: number; y: number; width: number; height: number };
  /** Stroked decoration (outline, features) */
  lines: ArtworkShape[];
  /** Thin stroked decoration (creases, contours) */
  details: ArtworkShape[];
  /** Filled decoration (iris, nostrils) */
  fills: ArtworkShape[];
  /** Bottom-to-top: the last matching shape wins a hit test */
  zones: ArtworkZone[];
}

export function getFaceArtwork(view: FaceView): MapArtwork {
  const { template, mirrored } = FACE_VIEW_CONFIGS[view];
  const mirror = mirrorTransform(template.width);
  const whole = mirrored ? mirror : undefined;
  // A mirrored copy of an already mirrored drawing is the original
  const copy = mirrored ? undefined : mirror;
  const shapes = (kind: keyof TemplateArt, prefix: string): ArtworkShape[] => [
    ...(template[kind] ?? []).map((d, i) => ({ key: `${prefix}${i}`, d, transform: whole })),
    ...(template.symmetric?.[kind] ?? []).flatMap((d, i) => [
      { key: `${prefix}s${i}`, d, transform: whole },
      { key: `${prefix}s${i}m`, d, transform: copy },
    ]),
  ];
  return {
    viewBox: { x: 0, y: 0, width: template.width, height: template.height },
    lines: shapes('lines', 'l'),
    details: shapes('details', 'd'),
    fills: shapes('fills', 'f'),
    zones: getFaceZones(view).map((z, i) => ({ key: `z${i}`, d: z.d, transform: z.mirrored ? mirror : undefined, zone: z.id, inert: false })),
  };
}

interface OmmShape {
  d: string;
  t: string;
  z?: string;
  k?: string;
}

interface OmmView {
  viewBox: number[];
  silhouette: OmmShape[];
  panels: OmmShape[];
}

type OmmFigure = Record<'front' | 'rear', OmmView>;

const figureCache = new Map<AestheticBodyFigure, Promise<OmmFigure>>();

function loadFigure(figure: AestheticBodyFigure): Promise<OmmFigure> {
  let promise = figureCache.get(figure);
  if (!promise) {
    // Separate chunks: the body artwork is only downloaded when the body map is opened
    promise = (figure === 'male' ? import('./open-muscle-map/male.json') : import('./open-muscle-map/female.json'))
      .then((mod) => mod.default as unknown as OmmFigure);
    promise.catch(() => figureCache.delete(figure));
    figureCache.set(figure, promise);
  }
  return promise;
}

export async function loadBodyArtwork(figure: AestheticBodyFigure, view: BodyView): Promise<MapArtwork> {
  const data = (await loadFigure(figure))[view === 'bodyFront' ? 'front' : 'rear'];
  const [x, y, width, height] = data.viewBox;
  return {
    viewBox: { x, y, width, height },
    // The silhouette is drawn as the body's outline
    lines: data.silhouette.map((shape, i) => ({ key: `s${i}`, d: shape.d, transform: shape.t })),
    details: [],
    fills: [],
    zones: data.panels.map((shape, i) => ({
      key: `p${i}`,
      d: shape.d,
      transform: shape.t,
      zone: shape.z as AestheticZoneId,
      inert: !!shape.k,
    })),
  };
}

/** Order used to list zones: face from top to bottom, then the body muscles */
export const ZONE_ORDER: AestheticZoneBase[] = [
  'forehead', 'glabella', 'temple', 'crowsFeet', 'tearTrough', 'nose', 'cheek', 'nasolabial',
  'upperLip', 'lowerLip', 'marionette', 'masseter', 'jawline', 'chin', 'neck',
  ...new Set([...BODY_VIEW_MUSCLES.bodyFront, ...BODY_VIEW_MUSCLES.bodyBack]),
];

export const MAP_REGIONS: AestheticMapRegion[] = ['face', 'body'];
export const REGION_VIEWS: Record<AestheticMapRegion, AestheticMapView[]> = {
  face: ['front', 'left', 'right'],
  body: ['bodyFront', 'bodyBack'],
};
export const MAP_VIEWS: AestheticMapView[] = MAP_REGIONS.flatMap((region) => REGION_VIEWS[region]);
export const BODY_FIGURES: AestheticBodyFigure[] = ['female', 'male'];

export const DEPTHS: AestheticDepth[] = ['intradermal', 'subcutaneous', 'supraperiosteal', 'intramuscular'];
export const TECHNIQUES: AestheticTechnique[] = ['bolus', 'linearRetrograde', 'fanning', 'microdroplets', 'cannula'];
