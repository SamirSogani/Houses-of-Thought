'use client'

import Link from 'next/link'
import { LogoMark } from '@/components/icons'

const linkGroups = [
  {
    heading: 'Product',
    links: [
      { label: 'Try it', href: '/try' },
      { label: 'Examples', href: '/examples' },
      { label: 'Framework', href: '/framework' },
    ],
  },
  {
    heading: 'Learn',
    links: [
      { label: 'How it works', href: '/how-it-works' },
      { label: 'For Educators', href: '/educators' },
      { label: 'Our Story', href: '/story' },
      { label: 'FAQ', href: '/faq' },
    ],
  },
  {
    heading: 'Legal',
    links: [
      { label: 'Terms', href: '/terms' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Contact', href: '/contact' },
    ],
  },
]

const colHeadStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 11,
  textTransform: 'uppercase',
  letterSpacing: '0.12em',
  color: 'var(--ink-subtle)',
  marginBottom: 14,
}

const linkStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 15,
  color: 'var(--parchment)',
  transition: 'color 0.15s',
}

export default function Footer() {
  return (
    <footer
      style={{
        background: 'var(--ink)',
        borderTop: '1px solid var(--ink-mid)',
        paddingBlock: 'var(--section-py)',
      }}
    >
      <div className="container">
        {/* Top row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 40,
          }}
        >
          {/* Brand */}
          <div style={{ flex: '1 1 280px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <LogoMark stroke="#F7F6F2" />
              <span
                style={{
                  fontFamily: 'var(--font-display)',
                  fontWeight: 600,
                  fontSize: 18,
                  letterSpacing: '-0.01em',
                  color: 'var(--parchment)',
                }}
              >
                Houses of Thought
              </span>
            </div>
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 15,
                lineHeight: 1.6,
                color: 'var(--rule)',
                maxWidth: '34ch',
                marginTop: 14,
              }}
            >
              Structured, defensible reasoning, with AI that guides instead of
              deciding.
            </p>
          </div>

          {/* Link columns */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 48 }}>
            {linkGroups.map((g) => (
              <div key={g.heading}>
                <p style={colHeadStyle}>{g.heading}</p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                  {g.links.map((l) => (
                    <Link
                      key={l.href}
                      href={l.href}
                      style={linkStyle}
                      onMouseEnter={(e) => (e.currentTarget.style.color = '#F2B021')}
                      onMouseLeave={(e) => (e.currentTarget.style.color = 'var(--parchment)')}
                    >
                      {l.label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div
          style={{
            marginTop: 48,
            paddingTop: 22,
            borderTop: '1px solid var(--ink-mid)',
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            gap: 12,
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            textTransform: 'uppercase',
            letterSpacing: '0.1em',
            color: 'var(--ink-subtle)',
          }}
        >
          <span>Sheet 99 / Footer</span>
          <span>© 2026 Houses of Thought · Intellectual Blueprint · Est. 2026</span>
        </div>
      </div>
    </footer>
  )
}
