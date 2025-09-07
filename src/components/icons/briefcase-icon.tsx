import { SVGProps } from 'react';

export function BriefcaseIcon(props: SVGProps<SVGSVGElement>) {
    return (
        <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" {...props}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.075c0 1.313-.964 2.505-2.292 2.852-.92.24-1.843.493-2.775.722-1.396.33-2.903.623-4.432.818-1.529.195-3.08.3-4.668.309a25.48 25.48 0 0 1-4.668-.31c-1.53-.195-3.036-.488-4.432-.818a25.047 25.047 0 0 1-2.775-.722C.964 19.58 0 18.384 0 17.075V13.5c0-.983.484-1.85 1.255-2.386a24.994 24.994 0 0 1 2.775-.722 25.047 25.047 0 0 1 4.432-.818c1.53-.195 3.08-.3 4.668-.309s3.138.114 4.668.31a25.047 25.047 0 0 1 4.432.818c.92.24 1.843.493 2.775.722.77.536 1.255 1.403 1.255 2.386v.65Z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
        </svg>
    );
}
