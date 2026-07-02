import { CheckIcon, XIcon } from '@/components/icons'

const studentFeatures = [
  { text: 'Structured house builder', ok: true },
  { text: 'Research Mode with cited sources', ok: true },
  { text: 'Logic Strength & Stress Test', ok: true },
  { text: 'Collab AI assistant steps back', ok: false },
]

const teacherFeatures = [
  'Everything in Student mode',
  'Collab AI co-reasoning assistant',
  'Classroom roster & review tools',
  'Assign, monitor & give feedback',
]

export default function EducatorDifferenceSection() {
  return (
    <section
      style={{ background: 'var(--white)', borderTop: '1px solid var(--rule)', paddingBlock: 'var(--section-py)' }}
    >
      <div className="container" data-reveal>
        <p className="eyebrow" style={{ color: 'var(--amber-hover)' }}>
          The key difference
        </p>
        <h2 className="h2" style={{ marginTop: 16, fontSize: 'clamp(28px, 3.6vw, 44px)', maxWidth: '20ch' }}>
          The AI won&rsquo;t do their homework. That&rsquo;s the point.
        </h2>

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 24, marginTop: 44 }}>
          {/* Student mode card */}
          <div
            style={{
              flex: '1 1 340px',
              background: 'var(--parchment)',
              border: '1px solid var(--ink)',
              borderRadius: 12,
              padding: 30,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)' }}>
                Student mode
              </h3>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  border: '1px solid var(--ink)',
                  borderRadius: 5,
                  padding: '4px 8px',
                  color: 'var(--ink)',
                }}
              >
                Assistant off
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-mid)', marginTop: 12 }}>
              A full structured builder, with the co-reasoning assistant switched
              off on purpose.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
              {studentFeatures.map((f) => (
                <div key={f.text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  {f.ok ? <CheckIcon /> : <XIcon />}
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-mid)' }}>{f.text}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Teacher & Standard card */}
          <div
            style={{
              flex: '1 1 340px',
              background: 'var(--white)',
              border: '1px solid var(--rule)',
              borderRadius: 12,
              padding: 30,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 22, color: 'var(--ink)' }}>
                Teacher & Standard
              </h3>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 11,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  border: '1px solid var(--green-strong)',
                  borderRadius: 5,
                  padding: '4px 8px',
                  color: 'var(--green-strong)',
                }}
              >
                Full access
              </span>
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-mid)', marginTop: 12 }}>
              Everything students get, plus the co-reasoning assistant for your
              own work.
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 22 }}>
              {teacherFeatures.map((text) => (
                <div key={text} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <CheckIcon />
                  <span style={{ fontFamily: 'var(--font-body)', fontSize: 15, color: 'var(--ink-mid)' }}>{text}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <p style={{ fontFamily: 'var(--font-body)', fontSize: 15, lineHeight: 1.6, color: 'var(--ink-subtle)', maxWidth: '60ch', marginTop: 28 }}>
          The restriction is pedagogy rather than a shortcoming. With the
          assistant stepped back, students do the reasoning themselves, which is
          the whole thing you set out to teach and grade.
        </p>
      </div>
    </section>
  )
}
