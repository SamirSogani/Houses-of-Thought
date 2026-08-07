'use client'

import { useState, useEffect, useRef } from 'react'

const layers = [
  {
    num: '01',
    name: 'Concepts',
    desc: 'Define the key terms before reasoning begins.',
    color: 'var(--rule)',
  },
  {
    num: '02',
    name: 'Question',
    desc: 'Frame the single overarching question.',
    color: 'var(--rule)',
  },
  {
    num: '03',
    name: 'Perspectives',
    desc: 'Self, Group, and Ideas — three lenses, not one.',
    color: 'var(--blueprint)',
    triple: true,
  },
  {
    num: '04',
    name: 'Evidence',
    desc: 'Cited sources from Research Mode. Checkable facts.',
    color: 'var(--verdict-pass)',
  },
  {
    num: '05',
    name: 'Assumptions',
    desc: 'Surface what you’re taking for granted.',
    color: 'var(--verdict-uncertain)',
  },
  {
    num: '06',
    name: 'Conclusion',
    desc: 'Synthesize. Scored across evidence, logic, coverage.',
    color: 'var(--amber)',
  },
  {
    num: '07',
    name: 'Implications',
    desc: 'What follows — positive, negative, uncertain.',
    color: 'var(--ink)',
  },
]

export default function InteractiveHouseSection() {
  const sectionRef = useRef<HTMLElement>(null)
  const [visibleLayers, setVisibleLayers] = useState(0)
  const [selectedLayer, setSelectedLayer] = useState<number | null>(null)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          // Start building the stack
          let count = 0
          const interval = setInterval(() => {
            count++
            setVisibleLayers(count)
            if (count >= layers.length) clearInterval(interval)
          }, 200)
          observer.disconnect()
          return () => clearInterval(interval)
        }
      },
      { threshold: 0.25 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      ref={sectionRef}
      className="ink-surface"
      data-surface="ink"
      style={{ paddingBlock: 'var(--section-py-lg)' }}
    >
      <div className="container">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 20,
          }}
        >
          <span
            style={{
              width: 24,
              height: 1,
              background: 'var(--amber)',
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 11,
              letterSpacing: '0.14em',
              textTransform: 'uppercase',
              color: 'var(--amber)',
            }}
          >
            The house
          </span>
        </div>

        <h2
          className="h2"
          style={{
            color: 'var(--parchment)',
            fontSize: 'clamp(28px, 4vw, 48px)',
            maxWidth: '26ch',
          }}
        >
          Reasoning, built one layer at a time.
        </h2>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 17,
            lineHeight: 1.6,
            color: 'var(--rule)',
            maxWidth: '48ch',
            marginTop: 14,
          }}
        >
          Every house rises from the foundation up. Each layer rests on the ones
          below it. The amber edge marks what&rsquo;s being reviewed right now.
        </p>

        {/* The stack */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: 'clamp(32px, 5vw, 64px)',
            marginTop: 56,
            alignItems: 'flex-end',
          }}
        >
          {/* Visual stack */}
          <div
            style={{
              flex: '1 1 320px',
              minWidth: 'min(280px, 100%)',
              display: 'flex',
              flexDirection: 'column-reverse',
              gap: 4,
            }}
          >
            {layers.map((layer, i) => {
              const visible = i < visibleLayers
              const isActive =
                i === visibleLayers - 1 && visibleLayers < layers.length
              const isSelected = selectedLayer === i

              return (
                <button
                  key={layer.num}
                  onClick={() =>
                    setSelectedLayer(isSelected ? null : i)
                  }
                  onMouseEnter={() => setSelectedLayer(i)}
                  aria-pressed={isSelected}
                  aria-label={`${layer.name}, layer ${layer.num}`}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: layer.triple ? '14px 16px' : '12px 16px',
                    borderRadius: 6,
                    border: isActive
                      ? '1px solid var(--amber)'
                      : isSelected
                        ? '1px solid var(--rule)'
                        : '1px solid var(--ink-mid)',
                    background: isActive
                      ? 'rgba(242, 176, 33, 0.08)'
                      : isSelected
                        ? 'rgba(247, 246, 242, 0.06)'
                        : 'rgba(247, 246, 242, 0.02)',
                    opacity: visible ? 1 : 0,
                    transform: visible
                      ? 'translateY(0)'
                      : 'translateY(16px)',
                    transition:
                      'opacity 0.44s cubic-bezier(0.16, 1, 0.3, 1), transform 0.44s cubic-bezier(0.16, 1, 0.3, 1), border-color 0.2s, background 0.2s',
                    cursor: 'pointer',
                    textAlign: 'left',
                    width: '100%',
                    color: 'var(--parchment)',
                    boxShadow: isActive
                      ? '0 0 16px rgba(242, 176, 33, 0.15)'
                      : 'none',
                  }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 10,
                      color: isActive
                        ? 'var(--amber)'
                        : 'var(--ink-subtle)',
                      minWidth: 18,
                    }}
                  >
                    {layer.num}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontWeight: 600,
                      fontSize: 14,
                    }}
                  >
                    {layer.name}
                  </span>
                  {layer.triple && (
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 9,
                        color: 'var(--rule)',
                        marginLeft: 'auto',
                        letterSpacing: '0.06em',
                      }}
                    >
                      SELF · GROUP · IDEAS
                    </span>
                  )}
                  {isActive && (
                    <span
                      style={{
                        marginLeft: layer.triple ? 0 : 'auto',
                        width: 6,
                        height: 6,
                        borderRadius: 1,
                        background: 'var(--amber)',
                        flexShrink: 0,
                      }}
                    />
                  )}
                </button>
              )
            })}

            {/* Roof */}
            <div
              style={{
                textAlign: 'center',
                padding: '8px 0',
                opacity: visibleLayers >= layers.length ? 1 : 0,
                transform:
                  visibleLayers >= layers.length
                    ? 'translateY(0)'
                    : 'translateY(16px)',
                transition:
                  'opacity 0.5s cubic-bezier(0.16, 1, 0.3, 1), transform 0.5s cubic-bezier(0.16, 1, 0.3, 1)',
              }}
            >
              <svg
                width="60"
                height="30"
                viewBox="0 0 60 30"
                aria-hidden="true"
                style={{ margin: '0 auto' }}
              >
                <path
                  d="M2 28 L30 4 L58 28"
                  stroke="var(--parchment)"
                  strokeWidth="1.6"
                  fill="none"
                />
              </svg>
            </div>
          </div>

          {/* Description panel */}
          <div
            style={{
              flex: '1 1 300px',
              minWidth: 'min(280px, 100%)',
            }}
          >
            <div
              aria-live="polite"
              style={{
                border: '1px solid var(--ink-mid)',
                borderRadius: 12,
                padding: 'clamp(24px, 3vw, 36px)',
                minHeight: 200,
                background: 'rgba(247, 246, 242, 0.03)',
              }}
            >
              {selectedLayer !== null ? (
                <>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                    }}
                  >
                    <span
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        background: 'var(--amber)',
                        color: 'var(--ink)',
                        borderRadius: 4,
                        minWidth: 26,
                        height: 22,
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        fontWeight: 500,
                        padding: '0 6px',
                      }}
                    >
                      {layers[selectedLayer].num}
                    </span>
                    <span
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: 11,
                        textTransform: 'uppercase',
                        letterSpacing: '0.1em',
                        color: 'var(--ink-subtle)',
                      }}
                    >
                      Layer {layers[selectedLayer].num} of 07
                    </span>
                  </div>
                  <h3
                    style={{
                      fontFamily: 'var(--font-display)',
                      fontWeight: 500,
                      fontSize: 28,
                      marginTop: 18,
                      color: 'var(--parchment)',
                    }}
                  >
                    {layers[selectedLayer].name}
                  </h3>
                  <p
                    style={{
                      fontFamily: 'var(--font-body)',
                      fontSize: 17,
                      lineHeight: 1.6,
                      color: 'var(--rule)',
                      marginTop: 12,
                    }}
                  >
                    {layers[selectedLayer].desc}
                  </p>
                </>
              ) : (
                <p
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontSize: 16,
                    color: 'var(--ink-subtle)',
                    fontStyle: 'italic',
                  }}
                >
                  Hover or tap a layer to learn what it holds.
                </p>
              )}
            </div>

            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--ink-subtle)',
                marginTop: 16,
              }}
            >
              Built bottom-up · each layer rests on the one below
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
