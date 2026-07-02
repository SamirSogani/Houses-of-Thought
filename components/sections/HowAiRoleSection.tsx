import { CheckIcon, XIcon } from '@/components/icons'

const doesItems = [
  'Asks sharpening questions to pressure-test your framing.',
  "Surfaces perspectives and stakeholders you're missing.",
  'Finds and cites real evidence in Research Mode.',
  "Stress-tests the conclusion once you've drawn it.",
]

const doesntItems = [
  'Write your conclusion for you.',
  'Hand you a verdict to copy and paste.',
  'Do the reasoning for you. In classroom mode the assistant steps back entirely, so the thinking stays the student’s own work.',
]

export default function HowAiRoleSection() {
  return (
    <section
      style={{ background: 'var(--parchment)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div className="container" data-reveal>
        <p className="eyebrow">The AI&rsquo;s role</p>
        <h2 className="h2" style={{ marginTop: 16, maxWidth: '22ch' }}>
          It guides. It doesn&rsquo;t decide.
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 44 }}>
          <div style={{ flex: '1 1 340px', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: 30 }}>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--green-strong)',
                marginBottom: 16,
              }}
            >
              What the AI does
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {doesItems.map((text) => (
                <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <CheckIcon />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, color: 'var(--ink-mid)' }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div style={{ flex: '1 1 340px', background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: 30 }}>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                textTransform: 'uppercase',
                letterSpacing: '0.1em',
                color: 'var(--warning)',
                marginBottom: 16,
              }}
            >
              What it doesn&rsquo;t
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {doesntItems.map((text) => (
                <div key={text} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <XIcon />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.5, color: 'var(--ink-mid)' }}>
                    {text}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
