
import { SVGProps } from 'react';

export function UyFlagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 900 600" {...props}>
      <path fill="#fff" d="M0 0h900v600H0z" />
      <path
        fill="#0038a8"
        d="M0 66.666h900v66.667H0zm0 200.001h900v66.667H0zm0 200.001h900v66.667H0z"
      />
      <path fill="#fff" d="M0 0h300v333.333H0z" />
      <path
        fill="#fcd116"
        d="m150 55.556-23.487 72.368 72.368 23.487-72.368 23.487 23.487 72.368 23.487-72.368-72.368-23.487 72.368-23.487z"
      />
    </svg>
  );
}
