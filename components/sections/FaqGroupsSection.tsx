'use client'

import { useState } from 'react'
import { ChevronIcon } from '@/components/icons'
import { faqGroups as groups, type FaqItem } from '@/lib/faq/data'

function AccordionItem({
  item,
  isLast,
  defaultOpen,
}: {
  item: FaqItem
  isLast: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      style={{
        borderTop: '1px solid var(--rule)',
        borderBottom: isLast ? '1px solid var(--rule)' : undefined,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '20px 0',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 20,
            color: 'var(--ink)',
          }}
        >
          {item.question}
        </span>
        <span
          style={{
            color: 'var(--ink-subtle)',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.24s',
          }}
        >
          <ChevronIcon />
        </span>
      </button>
      <div
        style={{
          display: open ? 'block' : 'none',
          padding: '0 0 22px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            lineHeight: 1.65,
            color: 'var(--ink-mid)',
            maxWidth: '64ch',
          }}
        >
          {item.answer}
        </p>
      </div>
    </div>
  )
}

export default function FaqGroupsSection() {
  return (
    <section style={{ paddingBlock: '0 var(--section-py)' }}>
      <div
        className="container paper-card"
        style={{ maxWidth: 820, padding: 'clamp(28px, 4vw, 48px)', display: 'flex', flexDirection: 'column', gap: 56 }}
      >
        {groups.map((group) => (
          <div key={group.label} data-reveal>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--amber-text)',
                marginBottom: 8,
              }}
            >
              {group.label}
            </p>
            <div>
              {group.items.map((item, i) => (
                <AccordionItem
                  key={item.question}
                  item={item}
                  isLast={i === group.items.length - 1}
                  defaultOpen={i === 0}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
