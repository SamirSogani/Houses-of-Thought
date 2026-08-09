// Home's compressed, non-interactive constellation teaser (redesign brief:
// "a compressed, non-interactive version of the seven-node diagram as a
// teaser with a link into How It Works").

import Constellation from './Constellation'

export default function DiagramTeaser() {
  return (
    <section style={{ paddingBlock: 'var(--section-py)', borderTop: '1px solid var(--dusk-rule)' }}>
      <div className="container">
        <div style={{ maxWidth: '58ch' }}>
          <p style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 500, letterSpacing: '0.12em', textTransform: 'uppercase', color: 'var(--amber)' }}>
            The method
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 500, fontSize: 'clamp(28px, 4vw, 42px)', letterSpacing: '-0.01em', color: 'var(--dusk-ink)', marginTop: 12 }}>
            Every run walks the same seven layers.
          </h2>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, lineHeight: 1.6, color: 'var(--dusk-ink-mid)', marginTop: 12 }}>
            Based on John Trapasso&rsquo;s classroom model, derived from the Paul&ndash;Elder
            framework for critical thinking.
          </p>
        </div>

        <div style={{ marginTop: 40 }}>
          <Constellation variant="compressed" />
        </div>
      </div>
    </section>
  )
}
