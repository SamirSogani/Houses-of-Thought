import { CheckIcon, XIcon } from '@/components/icons'
import { SparkIcon, PlusIcon } from '@/components/build/buildIcons'

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

        {/* Co-pilot in action: a faithful render of a single suggestion from the rail. */}
        <figure style={{ marginTop: 32, maxWidth: 540 }}>
          <figcaption
            className="mono"
            style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'var(--ink-subtle)', marginBottom: 12 }}
          >
            From the Co-pilot rail
          </figcaption>
          <div style={{ background: 'var(--white)', border: '1px solid var(--rule)', borderRadius: 12, padding: 18 }}>
            {/* Intro tile */}
            <div style={{ background: 'var(--parchment)', border: '1px solid var(--rule)', borderRadius: 11, padding: 13, display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ width: 26, height: 26, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: 'var(--ink)', borderRadius: 8, flex: '0 0 auto' }}>
                <SparkIcon size={14} fill="var(--amber)" />
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 13, color: 'var(--ink)' }}>Co-pilot · Evidence</div>
                <div style={{ fontSize: 12, color: 'var(--ink-subtle)', marginTop: 3, lineHeight: 1.45 }}>
                  Suggestions for this layer only. It guides. You decide what enters the house.
                </div>
              </div>
            </div>

            <div className="mono" style={{ fontSize: 10, color: 'var(--ink-subtle)', margin: '18px 0 10px' }}>
              Suggested for this layer
            </div>

            <div style={{ border: '1px solid var(--rule)', borderRadius: 11, padding: 13 }}>
              <div style={{ fontSize: 13, color: 'var(--ink)', lineHeight: 1.45 }}>
                Add the UNESCO figure: fewer than 10% of schools surveyed have formal guidance on generative AI.
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 11 }}>
                <span className="mono" style={{ fontSize: 9, color: 'var(--ink-subtle)' }}>Evidence · sourced</span>
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: 600, fontSize: 12, color: 'var(--ink)', background: 'var(--amber-tint)', border: '1px solid var(--amber)', borderRadius: 6, padding: '5px 11px' }}>
                  <PlusIcon size={12} />
                  Add
                </span>
              </div>
            </div>
          </div>
        </figure>
      </div>
    </section>
  )
}
