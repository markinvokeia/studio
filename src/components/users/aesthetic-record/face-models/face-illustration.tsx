'use client';

import React from 'react';

import type { AestheticBodyFigure } from '@/lib/types';
import { mirrorTransform } from '../map-templates';

// Shaded vector faces (female and male, front and profile) drawn over the SAME geometry as
// FRONT_TEMPLATE / PROFILE_TEMPLATE (300×380): the zones and every stored mark keep their
// place. First version from the UX prototype; a medical illustrator can replace it keeping
// the viewBox, the outline and the zone ids (see README.md).

export type FaceTone = 'light' | 'medium' | 'dark';
export const FACE_TONES: FaceTone[] = ['light', 'medium', 'dark'];

interface TonePalette {
  base: string;
  mid: string;
  shade: string;
  lipUpper: string;
  lipLower: string;
  hair: string;
  hairLight: string;
  brow: string;
  iris: string;
  irisDark: string;
  garment: string;
}

export const FACE_TONE_PALETTES: Record<FaceTone, TonePalette> = {
  light: { base: '#F4D8C8', mid: '#E7BBA4', shade: '#C58C73', lipUpper: '#B5636A', lipLower: '#C87A7D', hair: '#35251E', hairLight: '#5B4134', brow: '#4A3428', iris: '#8A6A4C', irisDark: '#3E2A1C', garment: '#D3CCDF' },
  medium: { base: '#DCAD8C', mid: '#C7926D', shade: '#9A664A', lipUpper: '#975350', lipLower: '#AC6862', hair: '#241914', hairLight: '#45322A', brow: '#2E2019', iris: '#6E4E33', irisDark: '#2C1C11', garment: '#C9D2DC' },
  dark: { base: '#9C6A4B', mid: '#82553B', shade: '#583522', lipUpper: '#6C3A33', lipLower: '#7F4840', hair: '#15100D', hairLight: '#2F231D', brow: '#1B130E', iris: '#4A321F', irisDark: '#1A0F08', garment: '#CFCAD8' },
};

const WIDTH = 300;
const MIRROR = mirrorTransform(WIDTH);

/** Draws `children` as-is and mirrored across the vertical centre: both sides of the face */
function Both({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <g transform={MIRROR}>{children}</g>
    </>
  );
}

/** Group drawn in the prototype's 400×520 space, placed so `from` lands on `to` */
function Placed({ from, to, k = 0.75, children }: { from: [number, number]; to: [number, number]; k?: number; children: React.ReactNode }) {
  return <g transform={`translate(${to[0]} ${to[1]}) scale(${k}) translate(${-from[0]} ${-from[1]})`}>{children}</g>;
}

interface FaceIllustrationProps {
  view: 'front' | 'left' | 'right';
  sex: AestheticBodyFigure;
  tone: FaceTone;
}

/** Face model behind the zones of a face view. The left profile is the right one mirrored, like its template */
export function FaceIllustration({ view, sex, tone }: FaceIllustrationProps) {
  const uid = `face${React.useId().replace(/:/g, '')}`;
  const palette = FACE_TONE_PALETTES[tone];
  const female = sex === 'female';
  if (view === 'front') return <FrontFace id={uid} t={palette} female={female} />;
  const profile = <ProfileFace id={uid} t={palette} female={female} />;
  return view === 'left' ? <g transform={MIRROR}>{profile}</g> : profile;
}

interface FaceProps {
  id: string;
  t: TonePalette;
  female: boolean;
}

// ──── Front ────

// Half outlines (patient's right, on the viewer's left) closed 2 units past the midline, so the
// mirrored half overlaps it and no seam shows
const FRONT_SKIN = {
  female: 'M150,26 C106,26 70,56 64,114 C61,144 63,170 67,192 C71,216 75,238 83,258 C92,280 108,300 126,312 C135,318 143,321 150,321 L152,321 L152,26 Z',
  male: 'M150,26 C104,26 66,56 62,114 C59,144 61,170 64,192 C68,218 72,242 80,264 C90,290 108,306 128,315 C137,319 144,321 150,321 L152,321 L152,26 Z',
};
const FRONT_NECK = {
  female: 'M100,280 C103,320 100,350 90,372 C82,376 70,378 56,380 L152,380 L152,280 Z',
  male: 'M94,280 C97,320 95,350 84,372 C76,376 62,378 48,380 L152,380 L152,280 Z',
};
const FRONT_EAR = 'M66,168 C56,158 45,166 47,186 C49,206 56,222 66,230 C70,233 74,231 75,226 L74,172 Z';
const FRONT_GARMENT = 'M0,380 L0,368 C30,356 60,352 86,350 C110,368 190,368 214,350 C240,352 270,356 300,368 L300,380 Z';

function FrontFace({ id, t, female }: FaceProps) {
  const skin = female ? FRONT_SKIN.female : FRONT_SKIN.male;
  const eye = female ? [12, 14, 9, 11] : [9, 11, 7, 9];
  // The prototype's eye, centred at (152, 214)
  const cx = 152;
  const cy = female ? 214 : 217;
  const eyePath = `M${cx - 26} ${cy + 1} C${cx - 17} ${cy - eye[0]} ${cx + 10} ${cy - eye[1]} ${cx + 25} ${cy - 1} C${cx + 15} ${cy + eye[2]} ${cx - 10} ${cy + eye[3]} ${cx - 26} ${cy + 1}Z`;
  const lid = `M${cx - 26} ${cy + 1} C${cx - 17} ${cy - eye[0]} ${cx + 10} ${cy - eye[1]} ${cx + 25} ${cy - 1}`;

  return (
    <g aria-hidden>
      <defs>
        <radialGradient id={`${id}sk`} gradientUnits="userSpaceOnUse" cx="150" cy="170" r="170">
          <stop offset="0" stopColor={t.base} />
          <stop offset=".62" stopColor={t.base} />
          <stop offset=".86" stopColor={t.mid} />
          <stop offset="1" stopColor={t.shade} />
        </radialGradient>
        <linearGradient id={`${id}nk`} gradientUnits="userSpaceOnUse" x1="0" y1="290" x2="0" y2="380">
          <stop offset="0" stopColor={t.shade} />
          <stop offset=".35" stopColor={t.mid} />
          <stop offset="1" stopColor={t.mid} />
        </linearGradient>
        <linearGradient id={`${id}hr`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2="0" y2="220">
          <stop offset="0" stopColor={t.hairLight} />
          <stop offset="1" stopColor={t.hair} />
        </linearGradient>
        <radialGradient id={`${id}ir`}>
          <stop offset="0" stopColor={t.iris} />
          <stop offset=".75" stopColor={t.irisDark} />
          <stop offset="1" stopColor="#120B08" />
        </radialGradient>
        <filter id={`${id}bl`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id={`${id}bs`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" /></filter>
        <clipPath id={`${id}fc`}>
          <path d={skin} />
          <path d={skin} transform={MIRROR} />
        </clipPath>
        <clipPath id={`${id}e`}><path d={eyePath} /></clipPath>
      </defs>

      {/* Hair behind the head: pulled back (female) or short (male) */}
      {female ? (
        <>
          <ellipse cx="150" cy="112" rx="90" ry="96" fill={`url(#${id}hr)`} />
          <ellipse cx="150" cy="24" rx="32" ry="22" fill={`url(#${id}hr)`} />
        </>
      ) : (
        <path d="M66,170 C56,92 96,16 150,14 C204,16 244,92 234,170 C230,140 224,120 214,108 L86,108 C76,120 70,140 66,170 Z" fill={`url(#${id}hr)`} />
      )}

      <Both><path d={female ? FRONT_NECK.female : FRONT_NECK.male} fill={`url(#${id}nk)`} /></Both>
      {!female && <path d="M145,350 C148,343 152,343 155,350" fill="none" stroke={t.shade} strokeWidth="1.6" opacity=".45" />}
      <path d={FRONT_GARMENT} fill={t.garment} />

      <Both>
        <path d={FRONT_EAR} fill={t.mid} />
        <path d="M60,178 C54,186 56,202 62,212" fill="none" stroke={t.shade} strokeWidth="1.6" strokeLinecap="round" opacity=".7" />
      </Both>

      <Both><path d={skin} fill={`url(#${id}sk)`} /></Both>

      {/* Soft volume: shadows and highlights, blurred and kept inside the face */}
      <g clipPath={`url(#${id}fc)`}>
        <g filter={`url(#${id}bl)`}>
          <Both>
            <ellipse cx="88" cy="232" rx="21" ry="34" fill={t.shade} opacity=".26" />
            <ellipse cx="74" cy="128" rx="16" ry="38" fill={t.shade} opacity=".22" />
            <ellipse cx="114" cy="174" rx="26" ry="13" fill={t.shade} opacity={female ? 0.22 : 0.3} />
            <ellipse cx="140" cy="198" rx="5" ry="25" fill={t.shade} opacity=".26" />
            <ellipse cx="112" cy="201" rx="16" ry="9" fill="#fff" opacity=".16" />
            {female && <ellipse cx="104" cy="221" rx="21" ry="12" fill="#E0787A" opacity=".16" />}
          </Both>
          {!female && <ellipse cx="150" cy="288" rx="70" ry="36" fill="#4D3F3B" opacity=".08" />}
          <ellipse cx="150" cy="238" rx="15" ry="4" fill={t.shade} opacity=".35" />
          <ellipse cx="150" cy="280" rx="18" ry="5" fill={t.shade} opacity=".28" />
          <ellipse cx="150" cy="96" rx="48" ry="22" fill="#fff" opacity=".2" />
          <ellipse cx="150" cy="190" rx="4.5" ry="22" fill="#fff" opacity=".28" />
          <ellipse cx="150" cy="220" rx="6" ry="4.5" fill="#fff" opacity=".3" />
          <ellipse cx="150" cy="298" rx="13" ry="7" fill="#fff" opacity=".14" />
        </g>
        {/* Nasolabial fold, barely there */}
        <Both>
          <path d="M128,222 C119,234 116,248 119,262" fill="none" stroke={t.shade} strokeWidth="1.5" strokeLinecap="round" opacity=".28" filter={`url(#${id}bs)`} />
        </Both>
      </g>

      {/* Eyes and brows: the prototype's, placed on the template's eyes */}
      <Placed from={[200, 214]} to={[150, 172]}>
        <Both200>
          <path d={eyePath} fill="#F4EDE9" />
          <g clipPath={`url(#${id}e)`}>
            <circle cx={cx + 1} cy={cy} r={female ? 10.5 : 9.8} fill={`url(#${id}ir)`} />
            <circle cx={cx + 1} cy={cy} r="4.2" fill="#140D0B" />
            <circle cx={cx + 4.5} cy={cy - 4} r="2.1" fill="#fff" opacity=".9" />
            <path d={lid} fill="none" stroke={t.shade} strokeWidth="7" opacity=".45" filter={`url(#${id}bs)`} />
          </g>
          <path d={lid} fill="none" stroke="#2A1C17" strokeWidth={female ? 2.7 : 2.1} strokeLinecap="round" />
          {female && <path d={`M${cx - 26} ${cy + 1} L${cx - 31} ${cy - 3}`} stroke="#2A1C17" strokeWidth="2" strokeLinecap="round" />}
          <path d={`M${cx - 24} ${cy + 2} C${cx - 10} ${cy + eye[3] + 1} ${cx + 14} ${cy + eye[2]} ${cx + 24} ${cy}`} fill="none" stroke={t.shade} strokeWidth="1.2" opacity=".5" />
          <path d={`M${cx - 24} ${cy - 6} C${cx - 12} ${cy - 21} ${cx + 12} ${cy - 22} ${cx + 24} ${cy - 8}`} fill="none" stroke={t.shade} strokeWidth="1.5" opacity=".5" />
          {female ? (
            <path d="M124 194 C134 182 152 174 168 175 C176 176 182 179 186 184 C178 183 170 182 160 183 C146 185 134 190 126 197Z" fill={t.brow} opacity=".9" />
          ) : (
            <path d="M118 196 C132 187 156 182 176 183 C182 184 186 187 188 192 C176 191 164 191 150 193 C136 195 126 198 120 202Z" fill={t.brow} opacity=".95" />
          )}
        </Both200>
      </Placed>

      {/* Nose */}
      <path d="M144,178 C145,196 144,208 140,214" fill="none" stroke={t.shade} strokeWidth="2.2" opacity=".14" filter={`url(#${id}bs)`} />
      <Placed from={[200, 305]} to={[150, 232]}>
        <Both200>
          {female ? (
            <>
              <path d="M184 290 C176 293 176 302 181 305 C185 307 190 306 193 305" fill="none" stroke={t.shade} strokeWidth="1.5" strokeLinecap="round" opacity=".55" />
              <ellipse cx="183" cy="298" rx="6" ry="7" fill={t.shade} opacity=".14" filter={`url(#${id}bs)`} />
              <ellipse cx="190" cy="304" rx="5.5" ry="2.5" fill="#3A2420" opacity=".5" transform="rotate(12 190 304)" />
            </>
          ) : (
            <>
              <path d="M182 290 C172 293 171 304 177 307 C182 309 188 308 192 307" fill="none" stroke={t.shade} strokeWidth="1.7" strokeLinecap="round" opacity=".55" />
              <ellipse cx="181" cy="298" rx="7" ry="8" fill={t.shade} opacity=".14" filter={`url(#${id}bs)`} />
              <ellipse cx="189" cy="305" rx="6" ry="2.8" fill="#3A2420" opacity=".5" transform="rotate(12 189 305)" />
            </>
          )}
        </Both200>
        <path d="M192 308 C196 311 204 311 208 308" fill="none" stroke={t.shade} strokeWidth="1.4" opacity=".35" />
        <path d="M194 316 L195 330" stroke={t.shade} strokeWidth="1.2" opacity=".22" />
        <path d="M206 316 L205 330" stroke={t.shade} strokeWidth="1.2" opacity=".22" />
      </Placed>

      {/* Lips */}
      <Placed from={[200, 341]} to={[150, 260]}>
        {female ? (
          <>
            <path d="M162 338 C174 331 186 324 194 326 C197 327 199 329 200 329 C201 329 203 327 206 326 C214 324 226 331 238 338 C224 341 212 342 200 342 C188 342 176 341 162 338Z" fill={t.lipUpper} />
            <path d="M164 339 C178 342 190 343 200 343 C210 343 222 342 236 339 C230 355 216 364 200 364 C184 364 170 355 164 339Z" fill={t.lipLower} />
            <path d="M162 338 C178 341 190 342 200 341 C210 342 222 341 238 338" fill="none" stroke="#5E2F30" strokeWidth="1.6" opacity=".7" strokeLinecap="round" />
            <ellipse cx="200" cy="351" rx="13" ry="3.4" fill="#fff" opacity=".22" />
            <ellipse cx="200" cy="331" rx="6" ry="1.6" fill="#fff" opacity=".2" />
          </>
        ) : (
          <>
            <path d="M166 340 C178 335 190 331 196 332 C198 333 200 334 200 334 C200 334 202 333 204 332 C210 331 222 335 234 340 C222 342 210 343 200 343 C190 343 178 342 166 340Z" fill={t.lipUpper} opacity=".82" />
            <path d="M168 341 C182 344 192 345 200 345 C208 345 218 344 232 341 C226 353 212 359 200 359 C188 359 174 353 168 341Z" fill={t.lipLower} opacity=".78" />
            <path d="M166 340 C182 343 192 343 200 343 C208 343 218 343 234 340" fill="none" stroke="#5E2F30" strokeWidth="1.5" opacity=".6" strokeLinecap="round" />
            <ellipse cx="200" cy="350" rx="11" ry="2.6" fill="#fff" opacity=".16" />
          </>
        )}
      </Placed>

      {/* Hair in front: it frames the forehead without covering it */}
      {female ? (
        <>
          <path d="M64,134 C56,76 92,18 150,16 C208,18 244,76 236,134 C228,104 214,80 192,70 C176,62 160,62 150,70 C140,62 124,62 108,70 C86,80 72,104 64,134 Z" fill={`url(#${id}hr)`} />
          <g fill="none" stroke={t.hairLight} strokeWidth="1.1" opacity=".7" strokeLinecap="round">
            <path d="M150,70 C142,52 128,42 110,40" />
            <path d="M150,70 C160,52 176,43 196,42" />
            <path d="M132,64 C120,55 106,52 94,55" />
          </g>
        </>
      ) : (
        <>
          <path d="M61,140 C54,80 94,18 150,16 C206,18 246,80 239,140 C233,116 227,100 216,90 C196,80 174,78 150,79 C126,78 104,80 84,90 C73,100 67,116 61,140 Z" fill={`url(#${id}hr)`} />
          <g fill="none" stroke={t.hairLight} strokeWidth="1" opacity=".6">
            <path d="M98,88 C112,76 132,71 150,72" />
            <path d="M202,88 C188,76 168,71 150,72" />
          </g>
        </>
      )}
    </g>
  );
}

/** Like {@link Both}, but in the prototype's space (mirrored across x = 200) */
function Both200({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <g transform="matrix(-1 0 0 1 400 0)">{children}</g>
    </>
  );
}

// ──── Profile (patient's right side: nose towards the viewer's right) ────

const PROFILE_SKIN = 'M150,26 C196,26 224,62 226,108 C227,124 226,138 228,150 C226,158 222,162 220,168 C226,184 240,200 252,212 C256,218 250,224 240,226 C236,228 232,230 230,232 C234,238 238,244 236,252 C232,256 228,258 226,260 C232,262 236,266 234,272 C230,278 224,282 222,284 C228,290 234,298 232,308 C228,318 220,324 206,326 C198,326 192,325 186,322 C194,342 198,360 200,380 L92,380 C96,340 96,300 92,262 C66,228 52,184 56,128 C60,66 96,26 150,26 Z';
const PROFILE_EAR = 'M118,172 C106,168 100,186 102,204 C104,222 112,236 124,236 C132,236 134,228 130,220 C128,206 130,188 132,178 C130,172 124,170 118,172 Z';
const PROFILE_JAW = 'M186,322 C170,316 152,306 140,292 C134,284 132,272 132,250';
const PROFILE_EYE = 'M205,167 C211,160 219,160 224,166 C218,173 210,173 205,167 Z';
const PROFILE_GARMENT = 'M64,380 C74,362 88,352 100,349 C126,358 166,364 194,358 C220,356 252,364 276,380 Z';

function ProfileFace({ id, t, female }: FaceProps) {
  return (
    <g aria-hidden>
      <defs>
        <linearGradient id={`${id}sk`} gradientUnits="userSpaceOnUse" x1="250" y1="0" x2="60" y2="0">
          <stop offset=".1" stopColor={t.base} />
          <stop offset=".55" stopColor={t.base} />
          <stop offset=".85" stopColor={t.mid} />
          <stop offset="1" stopColor={t.shade} />
        </linearGradient>
        <linearGradient id={`${id}hr`} gradientUnits="userSpaceOnUse" x1="220" y1="30" x2="60" y2="220">
          <stop offset="0" stopColor={t.hairLight} />
          <stop offset="1" stopColor={t.hair} />
        </linearGradient>
        <filter id={`${id}bl`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="6" /></filter>
        <filter id={`${id}bs`} x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="1.2" /></filter>
        <clipPath id={`${id}fc`}><path d={PROFILE_SKIN} /></clipPath>
        <clipPath id={`${id}e`}><path d={PROFILE_EYE} /></clipPath>
      </defs>

      {female && <circle cx="64" cy="98" r="25" fill={`url(#${id}hr)`} />}
      <path d={PROFILE_SKIN} fill={`url(#${id}sk)`} />

      <g clipPath={`url(#${id}fc)`}>
        <g filter={`url(#${id}bl)`}>
          <ellipse cx="192" cy="332" rx="34" ry="9" fill={t.shade} opacity=".3" />
          <ellipse cx="170" cy="252" rx="26" ry="18" fill={t.shade} opacity=".1" />
          <ellipse cx="212" cy="168" rx="16" ry="10" fill={t.shade} opacity=".26" />
          <path d={PROFILE_JAW} fill="none" stroke={t.shade} strokeWidth="6" opacity=".16" />
          <ellipse cx="240" cy="204" rx="4" ry="12" fill="#fff" opacity=".26" transform="rotate(-38 240 204)" />
          <ellipse cx="198" cy="202" rx="22" ry="10" fill="#fff" opacity=".16" />
          <ellipse cx="214" cy="100" rx="10" ry="26" fill="#fff" opacity=".2" />
          <ellipse cx="222" cy="300" rx="9" ry="8" fill="#fff" opacity=".14" />
          {female
            ? <ellipse cx="196" cy="222" rx="20" ry="12" fill="#E0787A" opacity=".15" />
            : <path d="M226,262 C200,272 168,280 148,272 L150,298 C172,318 206,326 226,314 Z" fill="#4D3F3B" opacity=".05" />}
        </g>
        <path d="M224,226 C214,238 210,250 212,264" fill="none" stroke={t.shade} strokeWidth="1.6" opacity=".3" filter={`url(#${id}bs)`} />
      </g>
      <path d={PROFILE_JAW} fill="none" stroke={t.shade} strokeWidth="1.1" opacity=".35" strokeLinecap="round" />
      {!female && <path d="M190,334 C196,340 197,348 194,355" fill="none" stroke={t.shade} strokeWidth="1.5" opacity=".45" />}

      <path d={PROFILE_GARMENT} fill={t.garment} />

      {/* Ear */}
      <path d={PROFILE_EAR} fill={t.mid} />
      <path d="M112,186 C108,196 110,214 118,222" fill="none" stroke={t.shade} strokeWidth="1.4" strokeLinecap="round" opacity=".7" />
      <path d="M118,198 C122,202 122,210 118,214" fill="none" stroke={t.shade} strokeWidth="1.1" opacity=".5" />

      {/* Eye and brow */}
      <path d={PROFILE_EYE} fill="#F3ECE8" />
      <g clipPath={`url(#${id}e)`}>
        <ellipse cx="219" cy="166" rx="2.8" ry="5" fill={t.irisDark} />
        <path d="M204,167 C211,159 219,159 225,165" fill="none" stroke={t.shade} strokeWidth="4.5" opacity=".4" filter={`url(#${id}bs)`} />
      </g>
      <path d="M204,167 C211,159 219,159 225,165" fill="none" stroke="#2A1C17" strokeWidth={female ? 1.9 : 1.5} strokeLinecap="round" />
      {female && <path d="M224,165 L229,161 M222,162 L226,157" stroke="#2A1C17" strokeWidth="1.3" strokeLinecap="round" />}
      <path d="M206,160 C212,154 220,154 225,159" fill="none" stroke={t.shade} strokeWidth="1.2" opacity=".5" />
      {female
        ? <path d="M192,148 C202,140 216,139 226,145 C214,145 204,146 194,151 Z" fill={t.brow} opacity=".9" />
        : <path d="M190,151 C202,145 216,144 228,148 C214,150 202,151 192,155 Z" fill={t.brow} opacity=".95" />}

      {/* Nose wing and nostril */}
      <path d="M240,214 C230,210 224,220 230,226 C233,228 237,227 240,225" fill="none" stroke={t.shade} strokeWidth="1.5" strokeLinecap="round" opacity=".7" />
      <ellipse cx="235" cy="222" rx="4" ry="1.8" fill="#3A2420" opacity=".45" />

      {/* Lips */}
      <g opacity={female ? 1 : 0.82}>
        <path d="M233,243 C237,246 237,251 235,253 C231,256 228,258 226,260 C224,254 226,248 233,243 Z" fill={t.lipUpper} />
        <path d="M226,260 C231,262 235,266 233,271 C230,275 226,278 223,279 C221,272 222,265 226,260 Z" fill={t.lipLower} />
        <path d="M226,260 L217,261" stroke="#5E2F30" strokeWidth="1.3" opacity=".6" strokeLinecap="round" />
      </g>

      {/* Hair: from the hairline back, the forehead and the temple stay visible */}
      {female ? (
        <>
          <path d="M206,58 C176,48 140,56 118,76 C102,92 98,112 100,130 C102,146 106,158 112,166 C100,176 86,194 74,212 C58,184 52,150 56,128 C60,66 96,26 150,26 C178,26 198,38 212,54 Z" fill={`url(#${id}hr)`} />
          <g fill="none" stroke={t.hairLight} strokeWidth="1.1" opacity=".7" strokeLinecap="round">
            <path d="M200,50 C170,42 136,50 112,70" />
            <path d="M118,80 C100,96 86,112 72,104" />
          </g>
        </>
      ) : (
        <>
          <path d="M204,60 C176,52 142,58 120,76 C106,90 102,110 104,130 C106,146 110,156 114,164 C102,176 90,192 82,206 C62,184 54,150 56,128 C60,66 96,26 150,26 C178,26 198,38 210,56 Z" fill={`url(#${id}hr)`} />
          <path d="M196,54 C166,46 134,54 114,72" fill="none" stroke={t.hairLight} strokeWidth="1" opacity=".6" />
        </>
      )}
    </g>
  );
}
