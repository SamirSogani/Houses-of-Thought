const chapterLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--amber-hover)',
}

const chapterHeadingStyle: React.CSSProperties = {
  fontFamily: 'var(--font-display)',
  fontWeight: 500,
  fontSize: 'clamp(26px, 3.2vw, 34px)',
  lineHeight: 1.15,
  color: 'var(--ink)',
  marginTop: 14,
}

const chapterBodyStyle: React.CSSProperties = {
  fontFamily: 'var(--font-body)',
  fontSize: 18,
  lineHeight: 1.7,
  color: 'var(--ink-mid)',
  marginTop: 16,
}

function PullQuote({ children }: { children: React.ReactNode }) {
  return (
    <figure
      style={{
        borderLeft: '3px solid var(--amber)',
        paddingLeft: 26,
      }}
      data-reveal
    >
      <blockquote
        style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 500,
          fontSize: 'clamp(24px, 3.2vw, 32px)',
          lineHeight: 1.25,
          color: 'var(--ink)',
        }}
      >
        {children}
      </blockquote>
    </figure>
  )
}

export default function StoryChaptersSection() {
  return (
    <section
      style={{
        background: 'var(--white)',
        borderTop: '1px solid var(--rule)',
        paddingBlock: 'var(--section-py)',
      }}
    >
      <div
        className="container"
        style={{ maxWidth: 720, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 64 }}
      >
        <article data-reveal>
          <p style={chapterLabelStyle}>01 / The spark</p>
          <h2 style={chapterHeadingStyle}>I kept watching smart people make messy decisions.</h2>
          <p style={chapterBodyStyle}>
            I&rsquo;ve spent a lot of time watching people I respect get stuck on
            decisions that didn&rsquo;t have to be that hard. Friends agonizing over
            jobs. Classmates arguing past each other. Myself, going in circles for
            weeks before realizing I&rsquo;d been asking the wrong question the whole
            time.
          </p>
          <p style={chapterBodyStyle}>
            The pattern was almost always the same. It wasn&rsquo;t intelligence they
            were short on, and it wasn&rsquo;t information. It was structure.
          </p>
        </article>

        <PullQuote>
          &ldquo;Not a lack of intelligence. Not a lack of information. A lack of
          structure.&rdquo;
        </PullQuote>

        <article data-reveal>
          <p style={chapterLabelStyle}>02 / The framework</p>
          <h2 style={chapterHeadingStyle}>The structure I needed already existed.</h2>
          <p style={chapterBodyStyle}>
            The part I was missing already had a shape. My teacher, John Trapasso,
            had built a model for working a question all the way through, layer by
            layer, drawn from the Paul&ndash;Elder Model for critical thinking. He
            chose to share it. That model is the framework Houses of Thought is
            built on.
          </p>
        </article>

        <article data-reveal>
          <p style={chapterLabelStyle}>03 / The build</p>
          <h2 style={chapterHeadingStyle}>So I built it.</h2>
          <p style={chapterBodyStyle}>
            I turned that framework into a tool. Houses of Thought is an AI-powered
            reasoning system built on John Trapasso&rsquo;s model. The AI walks the
            structure with you and pressure-tests your thinking, while the reasoning
            itself stays yours. I made it as a student, because the framework helped
            me and I wanted other people to be able to pick it up too.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink-subtle)',
              marginTop: 20,
            }}
          >
            Created by Samir Sogani. Based on John Trapasso&rsquo;s model, derived
            from the Paul&ndash;Elder Model for critical thinking.
          </p>
        </article>
      </div>
    </section>
  )
}
