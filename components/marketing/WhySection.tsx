// Home: problem/value framing, between the hero and the diagram teaser. No
// competitor named on this page (redesign brief) — this is about what the
// method itself does differently, not what it's not.

const PILLARS = [
  {
    title: 'It reasons in the open',
    body: 'Every layer and every verdict is visible while it happens — not a single answer with the thinking hidden behind it.',
  },
  {
    title: 'It checks its own work',
    body: 'Six of the seven layers are graded by nine independent reviewers before the run is allowed to continue, and a failed check sends the layer back to redo the work.',
  },
  {
    title: 'It won’t decide for you',
    body: 'It frames the question, builds the perspectives, and stress-tests the evidence. The conclusion — and the choice — stays yours.',
  },
]

export default function WhySection() {
  return (
    <section style={{ paddingBlock: 'var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
      <div className="container">
        <div style={{ maxWidth: '52ch' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--amber)' }}>
            Why it&rsquo;s different
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(28px, 4vw, 42px)', letterSpacing: '-0.01em', color: 'var(--dusk-ink)', marginTop: 12 }}>
            Most AI just answers. This reasons through it with you.
          </h2>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, marginTop: 36 }}>
          {PILLARS.map((p) => (
            <div key={p.title} className="dusk-card" style={{ padding: 'clamp(22px, 3vw, 28px)' }}>
              <h3 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 20, color: 'var(--dusk-ink)' }}>{p.title}</h3>
              <p style={{ fontFamily: 'var(--font-body)', fontSize: 14.5, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 10 }}>
                {p.body}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
