import React, { useId } from 'react';

export interface IconProps extends React.SVGProps<SVGSVGElement> {
  active?: boolean;
}

export function HomeIcon({ active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      strokeWidth={active ? '2' : '1.5'}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      color="currentColor"
      {...props}
    >
      <path
        d="M9 21H7C4.79086 21 3 19.2091 3 17V10.7076C3 9.30887 3.73061 8.01175 4.92679 7.28679L9.92679 4.25649C11.2011 3.48421 12.7989 3.48421 14.0732 4.25649L19.0732 7.28679C20.2694 8.01175 21 9.30887 21 10.7076V17C21 19.2091 19.2091 21 17 21H15M9 21V17C9 15.3431 10.3431 14 12 14V14C13.6569 14 15 15.3431 15 17V21M9 21H15"
        stroke="currentColor"
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function SearchIcon({ active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      strokeWidth={active ? '2' : '1.5'}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      color="currentColor"
      {...props}
    >
      <path
        d="M17 17L21 21"
        stroke="currentColor"
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M3 11C3 15.4183 6.58172 19 11 19C13.213 19 15.2161 18.1015 16.6644 16.6493C18.1077 15.2022 19 13.2053 19 11C19 6.58172 15.4183 3 11 3C6.58172 3 3 6.58172 3 11Z"
        stroke="currentColor"
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TvIcon({ active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      strokeWidth={active ? '2' : '1.5'}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      color="currentColor"
      {...props}
    >
      <path
        d="M7 21L17 21"
        stroke="currentColor"
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M2 16.4V3.6C2 3.26863 2.26863 3 2.6 3H21.4C21.7314 3 22 3.26863 22 3.6V16.4C22 16.7314 21.7314 17 21.4 17H2.6C2.26863 17 2 16.7314 2 16.4Z"
        stroke="currentColor"
        strokeWidth={active ? '2' : '1.5'}
      />
    </svg>
  );
}

export function MoviesIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24px"
      height="24px"
      fill="currentColor"
      viewBox="0 0 256 256"
      {...props}
    >
      <path d="M229.52,74.21a8,8,0,0,0-7.13-2A44,44,0,0,0,168,41.67a44,44,0,0,0-80,0,44,44,0,0,0-54.4,30.51,8,8,0,0,0-9.4,9.65L54.76,211.67A16,16,0,0,0,70.34,224H185.66a16,16,0,0,0,15.58-12.33L231.79,81.83A8,8,0,0,0,229.52,74.21ZM76,56a27.68,27.68,0,0,1,13.11,3.26,8,8,0,0,0,11.56-5.34,28,28,0,0,1,54.66,0,8,8,0,0,0,11.56,5.34A28,28,0,0,1,207,76.54l-38.56,11-34.49-13.8a16,16,0,0,0-11.88,0L87.57,87.56,49,76.54A28,28,0,0,1,76,56ZM70.34,208,42.91,91.44l37.85,10.81L94.86,208ZM145,208H111L96.75,101.12,128,88.62l31.25,12.5Zm40.66,0H161.14l14.1-105.75,37.85-10.81Z" />
    </svg>
  );
}

export function AnimeIcon({ active: _active, className = 'w-6 h-6', ...props }: IconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="24px"
      height="24px"
      viewBox="0 0 192 192"
      fill="none"
      className={className}
      {...props}
    >
      <path
        fill="currentColor"
        d="M163.649 83.141a6 6 0 0 0 11.591-3.105l-11.591 3.105Zm-11.909-33.41 4.379-4.102-4.379 4.102ZM51.343 41.498l-3.653-4.76 3.653 4.76ZM22.16 105.905l5.987-.392-5.987.392Zm11.149 34.7 5.095-3.168-5.095 3.168Zm23.19 30.543a6 6 0 1 0 6-10.392l-6 10.392Zm118.74-91.112a81.002 81.002 0 0 0-19.121-34.407l-8.758 8.203a69.009 69.009 0 0 1 16.288 29.31l11.591-3.106Zm-19.121-34.407a81.004 81.004 0 0 0-33.082-21.33l-3.858 11.363a69.004 69.004 0 0 1 28.182 18.17l8.758-8.203Zm-33.082-21.33a81 81 0 0 0-39.232-3.217l1.955 11.84a68.999 68.999 0 0 1 33.419 2.74l3.858-11.363Zm-39.232-3.217A81 81 0 0 0 47.69 36.738l7.306 9.52A69 69 0 0 1 85.76 32.923l-1.955-11.84ZM47.69 36.738a80.999 80.999 0 0 0-24.47 30.833l10.93 4.952A69 69 0 0 1 54.996 46.26l-7.306-9.52ZM23.22 67.571a81 81 0 0 0-7.047 38.727l11.975-.785a69.001 69.001 0 0 1 6.002-32.99l-10.93-4.952Zm-7.047 38.727a80.994 80.994 0 0 0 12.042 37.475l10.19-6.336a69 69 0 0 1-10.257-31.924l-11.975.785Zm12.042 37.475A80.998 80.998 0 0 0 56.5 171.148l6-10.392a69.003 69.003 0 0 1-24.095-23.319l-10.19 6.336Z"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="12"
        d="M154.201 99.466a51.502 51.502 0 0 1-26.891 54.699 51.497 51.497 0 0 1-69.453-69.519 51.5 51.5 0 0 1 54.725-26.839"
      />
      <path
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth="12"
        d="M154.125 99.377a29.502 29.502 0 0 1-39.486-2.02 29.498 29.498 0 0 1-2.013-39.486"
      />
    </svg>
  );
}

export function SparkIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z" />
    </svg>
  );
}

export function CategoriesIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="4" y="4" width="6" height="16" rx="1" />
      <circle cx="17" cy="8" r="3" />
      <rect x="14" y="14" width="6" height="6" rx="1" />
    </svg>
  );
}

export function WatchlistIcon({ active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.5'}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function ScheduleIcon({ active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={active ? '2' : '1.5'}
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <rect x="3" y="4" width="18" height="17" rx="3" />
      <path d="M16 2v4M8 2v4M3 10h18" />
      <circle cx="12" cy="15.5" r="2.2" />
      <path d="M12 14.3v1.2l.8.8" />
    </svg>
  );
}

export function UserIcon({ active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      strokeWidth={active ? '2' : '1.5'}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      color="currentColor"
      {...props}
    >
      <path
        d="M5 20V19C5 15.134 8.13401 12 12 12C15.866 12 19 15.134 19 19V20"
        stroke="currentColor"
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12C14.2091 12 16 10.2091 16 8C16 5.79086 14.2091 4 12 4C9.79086 4 8 5.79086 8 8C8 10.2091 9.79086 12 12 12Z"
        stroke="currentColor"
        strokeWidth={active ? '2' : '1.5'}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShuffleIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg
      width="24px"
      height="24px"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M22 6.99999C19 6.99999 13.5 6.99999 11.5 12.5C9.5 18 5 18 2 18" />
      <path d="M20 5C20 5 21.219 6.21895 22 7C21.219 7.78105 20 9 20 9" />
      <path d="M22 18C19 18 13.5 18 11.5 12.5C9.5 6.99999 5 7.00001 2 7" />
      <path d="M20 20C20 20 21.219 18.781 22 18C21.219 17.219 20 16 20 16" />
    </svg>
  );
}

export function PlayIcon({
  playing = false,
  className = 'w-6 h-6',
}: {
  playing?: boolean;
  className?: string;
}) {
  return playing ? (
    <svg
      width="24px"
      height="24px"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <rect x="6" y="5" width="4" height="14" rx="1.5" />
      <rect x="14" y="5" width="4" height="14" rx="1.5" />
    </svg>
  ) : (
    <svg
      width="24px"
      height="24px"
      className={className}
      viewBox="0 0 24 24"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M8 6.82v10.36c0 .79.87 1.27 1.54.84l8.14-5.18c.62-.39.62-1.29 0-1.69L9.54 5.98C8.87 5.55 8 6.03 8 6.82z" />
    </svg>
  );
}

export function VolumeIcon({
  className = 'w-5 h-5',
  isMuted,
  muted,
}: {
  className?: string;
  isMuted?: boolean;
  muted?: boolean;
}) {
  const showMuted = muted ?? isMuted ?? true;
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {showMuted ? (
        <>
          <path
            d="M18 14L20.0005 12M22 10L20.0005 12M20.0005 12L18 10M20.0005 12L22 14"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M2 13.8571V10.1429C2 9.03829 2.89543 8.14286 4 8.14286H6.9C7.09569 8.14286 7.28708 8.08544 7.45046 7.97772L13.4495 4.02228C14.1144 3.5839 15 4.06075 15 4.85714V19.1429C15 19.9392 14.1144 20.4161 13.4495 19.9777L7.45046 16.0223C7.28708 15.9146 7.09569 15.8571 6.9 15.8571H4C2.89543 15.8571 2 14.9617 2 13.8571Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </>
      ) : (
        <>
          <path
            d="M1 13.8571V10.1429C1 9.03829 1.89543 8.14286 3 8.14286H5.9C6.09569 8.14286 6.28708 8.08544 6.45046 7.97772L12.4495 4.02228C13.1144 3.5839 14 4.06075 14 4.85714V19.1429C14 19.9392 13.1144 20.4161 12.4495 19.9777L6.45046 16.0223C6.28708 15.9146 6.09569 15.8571 5.9 15.8571H3C1.89543 15.8571 1 14.9617 1 13.8571Z"
            stroke="currentColor"
            strokeWidth="1.5"
          />
          <path
            d="M17.5 7.5C17.5 7.5 19 9 19 11.5C19 14 17.5 15.5 17.5 15.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M20.5 4.5C20.5 4.5 23 7 23 11.5C23 16 20.5 18.5 20.5 18.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      )}
    </svg>
  );
}

export function ClockIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width="18px"
      height="18px"
      viewBox="0 0 256 256"
      fill="currentColor"
      className={className}
    >
      <path d="M232,136.66A104.12,104.12,0,1,1,119.34,24,8,8,0,0,1,120.66,40,88.12,88.12,0,1,0,216,135.34,8,8,0,0,1,232,136.66ZM120,72v56a8,8,0,0,0,8,8h56a8,8,0,0,0,0-16H136V72a8,8,0,0,0-16,0Zm40-24a12,12,0,1,0-12-12A12,12,0,0,0,160,48Zm36,24a12,12,0,1,0-12-12A12,12,0,0,0,196,72Zm24,36a12,12,0,1,0-12-12A12,12,0,0,0,220,108Z" />
    </svg>
  );
}

export function SparkleAiIcon({
  className = 'w-5 h-5 ml-2 text-white',
  stroke = 'currentColor',
}: {
  className?: string;
  stroke?: string;
}) {
  return (
    <svg
      width="20px"
      height="20px"
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      <path
        d="M8 15C12.8747 15 15 12.949 15 8C15 12.949 17.1104 15 22 15C17.1104 15 15 17.1104 15 22C15 17.1104 12.8747 15 8 15Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
      <path
        d="M2 6.5C5.13376 6.5 6.5 5.18153 6.5 2C6.5 5.18153 7.85669 6.5 11 6.5C7.85669 6.5 6.5 7.85669 6.5 11C6.5 7.85669 5.13376 6.5 2 6.5Z"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EditPencilIcon({ className = 'w-4 h-4' }: { className?: string }) {
  return (
    <svg
      width="18px"
      height="18px"
      className={className}
      viewBox="0 0 24 24"
      strokeWidth="1.5"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M14.3632 5.65156L15.8431 4.17157C16.6242 3.39052 17.8905 3.39052 18.6716 4.17157L20.0858 5.58579C20.8668 6.36683 20.8668 7.63316 20.0858 8.41421L18.6058 9.8942M14.3632 5.65156L4.74749 15.2672C4.41542 15.5993 4.21079 16.0376 4.16947 16.5054L3.92738 19.2459C3.87261 19.8659 4.39148 20.3848 5.0115 20.33L7.75191 20.0879C8.21972 20.0466 8.65806 19.8419 8.99013 19.5099L18.6058 9.8942M14.3632 5.65156L18.6058 9.8942"
        stroke="currentColor"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function KotatsuLogo({ className = 'w-8 h-8' }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 435 270"
      fill="none"
      className={className}
    >
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M123.4 0.0L127.7 0.0L132.8 2.1L150.9 20.2L151.1 21.8L155.9 26.2L156.1 27.8L167.9 42.2L168.1 43.8L169.9 45.2L170.0 46.8L177.9 57.2L178.1 58.8L181.4 62.0L252.8 62.0L254.1 59.2L257.9 55.8L258.1 54.2L260.9 51.8L263.1 47.2L265.9 44.8L272.1 34.2L278.9 26.8L279.1 25.2L299.2 4.1L305.4 1.0L314.7 1.0L318.8 3.1L333.9 19.2L334.1 20.8L338.0 25.2L345.0 40.2L345.0 42.7L348.0 49.3L348.0 52.7L349.0 53.3L349.0 56.7L350.0 57.3L351.0 67.7L352.0 68.3L355.0 103.8L360.9 111.2L366.1 120.8L367.9 122.2L369.0 125.8L375.9 135.2L384.1 150.8L386.0 152.2L388.0 157.8L390.0 159.2L392.0 164.8L394.0 166.2L430.0 236.2L430.0 238.8L433.0 243.2L433.0 246.7L434.0 247.4L434.0 256.7L430.9 262.8L426.8 266.9L422.7 269.0L409.4 269.0L408.6 270.0L17.4 270.0L14.8 268.0L8.2 266.0L4.8 262.1L3.2 261.9L0.0 255.6L0.0 247.3L3.0 241.8L3.0 239.2L42.0 163.2L43.9 161.8L50.0 149.2L51.9 147.8L53.0 144.2L54.9 142.8L62.1 129.2L65.9 124.8L67.1 121.2L72.9 113.8L74.0 110.2L75.9 108.8L80.0 101.8L80.0 85.4L81.0 84.6L81.0 76.4L82.0 75.7L83.0 63.3L84.0 62.7L86.0 50.3L87.0 49.8L90.0 38.2L93.0 33.8L93.0 31.2L95.1 27.2L97.0 25.8L98.1 22.2L101.9 17.8L102.1 16.2L113.2 5.1Z M136.6 122.0L125.2 126.1L115.1 135.2L110.0 147.3L110.0 151.7L109.0 152.4L110.0 158.7L111.0 159.3L111.0 162.8L116.1 171.8L125.2 179.9L131.4 183.0L149.7 183.0L156.8 179.9L165.9 170.8L171.0 159.7L171.0 153.3L168.9 149.2L164.8 146.0L161.6 145.0L151.2 144.9L149.0 140.7L148.0 130.3L145.9 125.2L141.8 122.0Z M286.6 123.0L285.7 124.0L282.2 124.0L275.8 128.9L274.2 129.1L267.0 137.2L263.0 147.4L264.0 161.7L267.0 168.8L269.9 171.2L270.1 172.8L278.2 180.0L284.4 183.0L303.7 183.0L312.8 177.9L318.9 170.8L324.0 159.7L324.0 153.3L323.0 152.8L322.9 150.2L317.8 146.0L314.6 145.0L304.1 144.8L302.0 140.7L301.0 129.3L300.0 128.8L300.0 126.2L297.8 124.1L295.6 123.0Z M199.6 181.0L195.2 183.1L191.0 187.2L189.0 191.3L189.0 198.7L191.1 202.8L204.9 216.2L205.1 217.8L209.2 221.9L211.2 223.0L217.6 224.0L222.8 221.9L243.0 200.8L244.0 197.6L244.0 191.2L241.9 187.2L237.8 183.1L233.8 181.0Z"
      />
    </svg>
  );
}

export function UsersIcon({ active: _active, ...props }: IconProps) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...props}
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  );
}

const STAR_PATH =
  'M53.8 0.0 L54.8 0.0 L55.3 1.0 L56.0 8.8 L57.5 15.6 L59.9 18.8 L61.9 19.6 L64.3 19.3 L100.0 7.1 L48.2 37.2 L44.0 40.1 L40.6 43.5 L39.1 46.0 L38.9 47.7 L39.9 48.7 L42.8 48.7 L61.1 41.3 L63.6 39.9 L75.3 55.7 L77.5 60.1 L75.3 60.6 L51.1 56.2 L47.4 56.5 L45.7 57.9 L30.6 79.0 L29.6 79.5 L28.6 78.7 L28.1 76.5 L25.7 59.7 L23.7 57.2 L19.3 57.5 L0.0 64.1 L36.7 41.6 L41.6 37.4 L44.7 33.3 L43.8 31.1 L41.3 31.1 L19.6 39.9 L6.6 21.8 L5.6 19.6 L6.1 19.1 L9.0 19.3 L32.8 23.7 L35.5 23.7 L39.4 20.0Z';

const DOC_LINES: [string, string, string][] = [
  ['.15s', 'M38 23h26', '#c9d6e6'],
  ['.3s', 'M38 35h40', '#343a45'],
  ['.42s', 'M38 43h34', '#343a45'],
  ['.54s', 'M38 51h40', '#343a45'],
  ['.66s', 'M38 59h22', '#343a45'],
];

export function TermsEmblem() {
  return (
    <svg className="pe" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <path
        d="M34 8h40l14 14v60a6 6 0 0 1-6 6H34a6 6 0 0 1-6-6V14a6 6 0 0 1 6-6Z"
        fill="#15181e"
        stroke="#2a2f38"
        strokeWidth="1.5"
      />
      <path d="M74 8v10a4 4 0 0 0 4 4h10Z" fill="#2f3540" />
      {DOC_LINES.map(([delay, d, stroke], i) => (
        <path
          key={i}
          className="pe-ln pe-fb"
          style={{ '--d': delay } as React.CSSProperties}
          d={d}
          stroke={stroke}
          strokeWidth={i === 0 ? 3 : 2.5}
          strokeLinecap="round"
        />
      ))}
      <circle
        className="pe-ripple pe-fb"
        cx="82"
        cy="74"
        r="14"
        stroke="#7fb6ff"
        strokeWidth="1.5"
      />
      <g className="pe-seal pe-fb">
        <circle cx="82" cy="74" r="14" fill="#0f1115" stroke="#dcecff" strokeWidth="1.6" />
        <circle
          cx="82"
          cy="74"
          r="10.5"
          stroke="#dcecff"
          strokeOpacity=".25"
          strokeWidth="1"
          strokeDasharray="1.5 2"
        />
        <path d={STAR_PATH} fill="#dcecff" transform="translate(73.4 67.2) scale(.172)" />
      </g>
    </svg>
  );
}

const SHIELD_PATH = 'M60 8 88 18v26c0 20-12 34-28 44C44 78 32 64 32 44V18Z';

export function PrivacyEmblem() {
  const id = useId().replace(/:/g, '');
  const shieldId = `pe-shield-${id}`;
  const haloId = `pe-halo-${id}`;
  const sheenId = `pe-sheen-${id}`;
  return (
    <svg className="pe" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <defs>
        <clipPath id={shieldId}>
          <path d={SHIELD_PATH} />
        </clipPath>
        <radialGradient id={haloId}>
          <stop offset="0" stopColor="#7fb6ff" stopOpacity=".35" />
          <stop offset="1" stopColor="#7fb6ff" stopOpacity="0" />
        </radialGradient>
        <linearGradient id={sheenId} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#fff" stopOpacity="0" />
          <stop offset=".5" stopColor="#fff" stopOpacity=".35" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <circle className="pe-fill" cx="60" cy="48" r="44" fill={`url(#${haloId})`} />
      <path className="pe-fill" d={SHIELD_PATH} fill="#15181e" />
      <path
        className="pe-draw"
        pathLength={1}
        d={SHIELD_PATH}
        stroke="#dcecff"
        strokeWidth="2.5"
        strokeLinejoin="round"
      />
      <path
        className="pe-fill"
        d="M60 15.5 81.5 23.2v20.8c0 15.6-9.2 26.8-21.5 35.1C47.7 70.8 38.5 59.6 38.5 44V23.2Z"
        stroke="#2a2f38"
        strokeWidth="1.2"
      />
      <g className="pe-star-in pe-fb">
        <path d={STAR_PATH} fill="#dcecff" transform="translate(45.5 33.5) scale(.29)" />
      </g>
      <g clipPath={`url(#${shieldId})`}>
        <g transform="skewX(-18)">
          <rect className="pe-sweep" x="38" y="0" width="22" height="96" fill={`url(#${sheenId})`} />
        </g>
      </g>
    </svg>
  );
}

export function DmcaEmblem() {
  return (
    <svg className="pe" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <g className="pe-tile">
        <rect x="14" y="14" width="72" height="52" rx="9" fill="#15181e" stroke="#2a2f38" strokeWidth="1.5" />
        <rect x="20" y="58" width="60" height="3" rx="1.5" fill="#2a2f38" />
        <rect x="20" y="58" width="26" height="3" rx="1.5" fill="#c9d6e6" />
        <path d="M45 28.5v19l15-9.5Z" fill="#343a45" stroke="#343a45" strokeWidth="3" strokeLinejoin="round" />
      </g>
      <g className="pe-badge pe-fb">
        <circle cx="84" cy="66" r="19" fill="#0f1115" />
        <circle
          className="pe-ring"
          pathLength={1}
          cx="84"
          cy="66"
          r="16"
          stroke="#dcecff"
          strokeWidth="2.5"
          transform="rotate(-90 84 66)"
        />
        <path
          className="pe-cee"
          pathLength={1}
          d="M89.3 60.7a7.5 7.5 0 1 0 0 10.6"
          stroke="#dcecff"
          strokeWidth="3"
          strokeLinecap="round"
        />
      </g>
      <g className="pe-spark pe-fb">
        <path d="M104 30c.6 4.2 1.8 5.4 6 6-4.2.6-5.4 1.8-6 6-.6-4.2-1.8-5.4-6-6 4.2-.6 5.4-1.8 6-6Z" fill="#7fb6ff" />
      </g>
    </svg>
  );
}

export function HelpEmblem() {
  return (
    <svg className="pe" viewBox="0 0 120 96" fill="none" aria-hidden="true">
      <g className="pe-bubble pe-fb">
        <path
          d="M38 12h44a14 14 0 0 1 14 14v28a14 14 0 0 1-14 14H56L42 82V68h-4a14 14 0 0 1-14-14V26a14 14 0 0 1 14-14Z"
          fill="#15181e"
          stroke="#2a2f38"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </g>
      <path
        className="pe-q"
        pathLength={1}
        d="M51.5 32.5a8.5 8.5 0 1 1 12 7.8c-2.2 1-3.5 2.6-3.5 5v2.2"
        stroke="#dcecff"
        strokeWidth="4.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle className="pe-qdot pe-fb" cx="60" cy="56" r="2.9" fill="#dcecff" />
      <g className="pe-spark2 pe-fb">
        <path d={STAR_PATH} fill="#7fb6ff" transform="translate(86 4) scale(.2)" />
      </g>
    </svg>
  );
}
