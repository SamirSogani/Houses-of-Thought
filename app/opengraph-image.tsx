// Site-wide Open Graph / Twitter card image (seo #3). Generated with
// ImageResponse rather than committed as a PNG: the repo has no raster assets
// and this keeps the card in sync with the brand tokens. Every share of any URL
// used to render as a bare blue link — for a product spread teacher-to-teacher,
// link previews are a primary discovery channel.

import { ImageResponse } from 'next/og'

export const alt = 'Houses of Thought — build the reasoning, not just the answer'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

const INK = '#14213A'
const PARCHMENT = '#F7F6F2'
const AMBER = '#F2B021'
const RULE = '#5A6B85'

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          background: INK,
          padding: '72px 80px',
        }}
      >
        {/* House mark + wordmark */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <svg width="56" height="56" viewBox="0 0 48 48" fill="none">
            <path
              d="M24 9L8 21.5V39h9V29.5h14V39h9V21.5L24 9Z"
              fill={AMBER}
              fillOpacity="0.18"
              stroke={AMBER}
              strokeWidth="2.4"
              strokeLinejoin="round"
            />
          </svg>
          <div
            style={{
              fontSize: 26,
              letterSpacing: '0.18em',
              textTransform: 'uppercase',
              color: PARCHMENT,
            }}
          >
            Houses of Thought
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 76, lineHeight: 1.08, color: PARCHMENT, letterSpacing: '-0.02em' }}>
            Build the reasoning,
          </div>
          <div style={{ fontSize: 76, lineHeight: 1.08, color: AMBER, letterSpacing: '-0.02em' }}>
            not just the answer.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16, fontSize: 22, color: RULE, flexWrap: 'wrap' }}>
          <span>Frame</span>
          <span style={{ color: AMBER }}>·</span>
          <span>Perspectives</span>
          <span style={{ color: AMBER }}>·</span>
          <span>Global Assumptions</span>
          <span style={{ color: AMBER }}>·</span>
          <span>Global Evidence</span>
          <span style={{ color: AMBER }}>·</span>
          <span>Conclusions</span>
          <span style={{ color: AMBER }}>·</span>
          <span>Implications</span>
        </div>
      </div>
    ),
    size
  )
}
