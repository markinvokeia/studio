
import { SVGProps } from 'react';

export function EsFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" {...props}>
      <path fill="#aa151b" d="M0 0h900v600H0z" />
      <path fill="#f1bf00" d="M0 150h900v300H0z" />
    </svg>
  );
}
