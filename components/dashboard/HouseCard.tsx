'use client'

// A single house card + the "Create New House" tile for the dashboard grid.
// Brand-styled: white card, rule border, mono meta labels, amber progress bar,
// semantic status chip. Both link into the Build a House flow.

import Link from 'next/link'
import type { HouseSummary } from '@/lib/dashboard/houses'
import { housePercent, statusMeta } from '@/lib/dashboard/houses'
import { PlusIcon } from '@/components/build/buildIcons'

export function HouseCard({ house, href }: { house: HouseSummary; href: string }) {
  const percent = housePercent(house)
  const meta = statusMeta[house.status]

  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--white)',
        border: '1px solid var(--rule)',
        borderRadius: 'var(--radius-card)',
        padding: 20,
        minHeight: 190,
        transition: 'border-color 0.15s, box-shadow 0.15s, transform 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ink)'
        e.currentTarget.style.boxShadow = '0 8px 24px rgba(20,33,58,0.08)'
        e.currentTarget.style.transform = 'translateY(-2px)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--rule)'
        e.currentTarget.style.boxShadow = 'none'
        e.currentTarget.style.transform = 'none'
      }}
    >
      <h3
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 20,
          letterSpacing: '-0.01em',
          color: house.title ? 'var(--ink)' : 'var(--ink-subtle)',
          lineHeight: 1.2,
          overflow: 'hidden',
          textOverflow: 'ellipsis',
          whiteSpace: 'nowrap',
        }}
      >
        {house.title ?? 'Untitled House'}
      </h3>

      {/* Progress line */}
      <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', marginTop: 10 }}>
        {house.layersComplete}/7 layers complete · {percent}%
      </div>
      <div style={{ height: 5, background: 'var(--rule)', borderRadius: 3, overflow: 'hidden', marginTop: 8 }}>
        <div
          className="build-bar-fill"
          style={{
            height: '100%',
            width: `${percent}%`,
            background: house.status === 'complete' ? 'var(--green-strong)' : 'var(--amber)',
            borderRadius: 3,
            transition: 'width 0.4s cubic-bezier(0.2,0.7,0.2,1)',
          }}
        />
      </div>

      {/* Question preview */}
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 14,
          color: house.question ? 'var(--ink-mid)' : 'var(--ink-subtle)',
          fontStyle: house.question ? 'normal' : 'italic',
          lineHeight: 1.45,
          marginTop: 14,
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {house.question ?? 'No question set yet'}
      </p>

      {/* Footer meta */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 'auto', paddingTop: 16 }}>
        <span
          className="mono"
          style={{ fontSize: 9, color: meta.color, background: meta.bg, border: `1px solid ${meta.color}`, borderRadius: 5, padding: '2px 8px' }}
        >
          {meta.label}
        </span>
        <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>{house.editedLabel}</span>
      </div>
    </Link>
  )
}

export function CreateHouseCard({ href }: { href: string }) {
  return (
    <Link
      href={href}
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 14,
        minHeight: 190,
        border: '1.5px dashed var(--rule)',
        borderRadius: 'var(--radius-card)',
        color: 'var(--ink)',
        transition: 'border-color 0.15s, background 0.15s',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--ink)'
        e.currentTarget.style.background = 'rgba(20,33,58,0.02)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--rule)'
        e.currentTarget.style.background = 'transparent'
      }}
    >
      <span
        style={{
          width: 48,
          height: 48,
          borderRadius: '50%',
          background: 'var(--amber-tint)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--ink)',
        }}
      >
        <PlusIcon size={22} />
      </span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 18, color: 'var(--ink)' }}>Create New House</span>
    </Link>
  )
}
