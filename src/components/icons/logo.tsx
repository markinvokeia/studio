import * as React from "react";
import { SVGProps } from "react";

export const Logo = (props: SVGProps<SVGSVGElement>) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    xmlnsXlink="http://www.w3.org/1999/xlink"
    width="1em"
    height="1em"
    viewBox="0 0 1024 1024"
    {...props}
  >
    <defs>
      <path
        id="a"
        d="M512 0c55.378 0 108.97 12.06 158.423 35.313C729.133 62.43 789.28 103.88 836.92 156.456c47.64 52.574 81.16 115.34 98.412 183.4C952.583 399.71 958 459.77 958 521c0 58.078-4.99 115.42-14.73 169.873-10.45 57.51-29.23 112.98-55.78 164.21-27.18 52.48-62.58 98.98-105.23 137.6-43.21 39.14-93.88 69.82-149.88 90.6-56 20.78-116.48 31.717-179.88 31.717-64.21 0-125.79-11.21-182.26-33.09C258.752 982.93 205.613 952.92 160.03 913.06c-45.584-39.86-82.68-88.85-109.11-144.57C24.488 712.77 4.998 650.05 0 581.527.012 562.14 0 541.49 0 520.592c0-21.31-.01-42.34.002-63.092C.92 387.97 8.04 319.46 22.84 255.77c15.22-65.51 38.45-127.35 69.1-182.88C123.63 21.6 156.32 0 216.59 0H512Z"
      />
      <radialGradient
        id="b"
        cx={0}
        cy={0}
        r={1}
        gradientTransform="matrix(0 -512 512 0 512 512)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#00AEEF" />
        <stop offset={1} stopColor="#A6CE39" />
      </radialGradient>
      <radialGradient
        id="c"
        cx={0}
        cy={0}
        r={1}
        gradientTransform="matrix(270.38 -450.45 448.98 269.45 500.15 512.42)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#A6CE39" />
        <stop offset={1} stopColor="#EC008C" />
      </radialGradient>
      <radialGradient
        id="d"
        cx={0}
        cy={0}
        r={1}
        gradientTransform="matrix(-244.15 -460.7 459.25 -243.39 527.15 500.03)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#EC008C" />
        <stop offset={1} stopColor="#FFF200" />
      </radialGradient>
      <radialGradient
        id="e"
        cx={0}
        cy={0}
        r={1}
        gradientTransform="matrix(-507.03 147.2 -146.7 -505.47 508.03 521.82)"
        gradientUnits="userSpaceOnUse"
      >
        <stop stopColor="#FFF200" />
        <stop offset={1} stopColor="#00AEEF" />
      </radialGradient>
    </defs>
    <use fill="url(#b)" xlinkHref="#a" />
    <use fill="url(#c)" xlinkHref="#a" />
    <use fill="url(#d)" xlinkHref="#a" />
    <use fill="url(#e)" xlinkHref="#a" />
    <path
      d="M392.33 630.9h-45.74V404.14h45.74v226.76Zm107.5 120.31L420.9 404.14h51.84l48.8 221.72 49.06-221.72h50.31L542 751.21h-50.57l-15.5-70.52h-58.11l-16.02 70.52h-52.17Z"
      fill="#fff"
    />
  </svg>
);
