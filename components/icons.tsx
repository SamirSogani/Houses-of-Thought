export function ArrowIcon({ size = 15 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 8h9M8 4l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LogoMark({ stroke = '#14213A' }: { stroke?: string }) {
  return (
    <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
      <path d="M3 12 L13 3 L23 12" stroke={stroke} strokeWidth="1.6" fill="none" />
      <rect x="6" y="12" width="14" height="11" stroke={stroke} strokeWidth="1.6" fill="none" />
      <line x1="6" y1="16.3" x2="20" y2="16.3" stroke={stroke} strokeWidth="1.2" />
      <rect x="11" y="18.5" width="4" height="4.5" fill="#F2B021" />
    </svg>
  )
}

export function CheckIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="var(--green-strong)" strokeWidth="1.4" fill="none" />
      <path
        d="M6 10.5l2.5 2.5L14 7"
        stroke="var(--green-strong)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function XIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="9" stroke="var(--warning)" strokeWidth="1.4" fill="none" />
      <path
        d="M7 7l6 6M13 7l-6 6"
        stroke="var(--warning)"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
      />
    </svg>
  )
}

export function ChevronIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M4 6l4 4 4-4"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

// Try It — build-stage + POV-chip icons (components/try/TryItFlow.tsx,
// components/try/MiniHouseResult.tsx). Same thin-stroke / currentColor / no-fill
// style as the icons above.
export function SparklesIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M9 3l1 3.5L13.5 8 10 9l-1 3.5L8 9 4.5 8 8 6.5z"
        stroke="currentColor"
        strokeWidth="1.1"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M15 11.5l.6 2 2 .6-2 .6-.6 2-.6-2-2-.6 2-.6z"
        stroke="currentColor"
        strokeWidth="1"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function CompassIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.4" fill="none" />
      <path
        d="M13 7l-2 5-4 1 2-5z"
        stroke="currentColor"
        strokeWidth="1.2"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function BrainIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M7 4.5c-1.7 0-3 1.3-3 2.9 0 .6.2 1.1.5 1.6-.6.5-1 1.3-1 2.1 0 1.4 1 2.5 2.3 2.8.2 1.3 1.3 2.1 2.7 2.1H10V4.5H7z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
      />
      <path
        d="M13 4.5c1.7 0 3 1.3 3 2.9 0 .6-.2 1.1-.5 1.6.6.5 1 1.3 1 2.1 0 1.4-1 2.5-2.3 2.8-.2 1.3-1.3 2.1-2.7 2.1H10V4.5h3z"
        stroke="currentColor"
        strokeWidth="1.3"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function LightbulbIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 3a5.5 5.5 0 0 0-3 10.1c.5.4.8 1 .8 1.6v.3h4.4v-.3c0-.6.3-1.2.8-1.6A5.5 5.5 0 0 0 10 3z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <line x1="8.2" y1="17" x2="11.8" y2="17" stroke="currentColor" strokeWidth="1.3" />
      <line x1="8.6" y1="18.4" x2="11.4" y2="18.4" stroke="currentColor" strokeWidth="1.3" />
    </svg>
  )
}

export function BookOpenIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 5.2C8.6 4.2 6.6 3.8 4.5 4v10.5c2.1-.2 4.1.2 5.5 1.2 1.4-1 3.4-1.4 5.5-1.2V4c-2.1-.2-4.1.2-5.5 1.2z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
      <line x1="10" y1="5.2" x2="10" y2="15.7" stroke="currentColor" strokeWidth="1.4" />
    </svg>
  )
}

export function HeartIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M10 16.3S3.5 12.4 3.5 7.9A3.4 3.4 0 0 1 10 6.2a3.4 3.4 0 0 1 6.5 1.7c0 4.5-6.5 8.4-6.5 8.4z"
        stroke="currentColor"
        strokeWidth="1.4"
        fill="none"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function TrendingUpIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3.5 13.5l4.5-4.5 3 3 5.5-5.5"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12.5 6.5h4v4"
        stroke="currentColor"
        strokeWidth="1.6"
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
