const chapterLabelStyle: React.CSSProperties = {
  fontFamily: 'var(--font-mono)',
  fontSize: 12,
  letterSpacing: '0.14em',
  textTransform: 'uppercase',
  color: 'var(--amber-text)',
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

export default function StoryChaptersSection() {
  return (
    <section style={{ paddingBlock: '0 var(--section-py)' }}>
      <div
        className="container paper-card"
        style={{ maxWidth: 720, padding: 'clamp(28px, 4vw, 48px)', display: 'flex', flexDirection: 'column', gap: 64 }}
      >
        <article data-reveal>
          <p style={chapterLabelStyle}>01 / The spark</p>
          <h2 style={chapterHeadingStyle}>I kept watching smart people make messy decisions.</h2>
          <p style={chapterBodyStyle}>
            Friends would agonize over a job offer for weeks and still second-guess
            it after taking it. Classmates would win an argument by talking the
            loudest, not by making the better case. I did the same thing to myself
            more than once, circling a decision for days before realizing I&rsquo;d
            never actually pinned down what I was deciding.
          </p>
          <p style={chapterBodyStyle}>
            It was never a lack of intelligence, and it was never a lack of
            information. What was missing, every time, was structure.
          </p>
        </article>

        <article data-reveal>
          <p style={chapterLabelStyle}>02 / The framework</p>
          <h2 style={chapterHeadingStyle}>The structure already existed. I just hadn&rsquo;t seen it yet.</h2>
          <p style={chapterBodyStyle}>
            My teacher, John Trapasso, had spent years teaching a framework for
            exactly this: work a question all the way through, one layer at a time,
            grounded in the Paul&ndash;Elder model for critical thinking. When he
            shared it with me, the gap I kept running into finally made sense.
          </p>
        </article>

        <article data-reveal>
          <p style={chapterLabelStyle}>03 / The build</p>
          <h2 style={chapterHeadingStyle}>So I built it.</h2>
          <p style={chapterBodyStyle}>
            Houses of Thought is that framework, built into software. It walks the
            same structure Trapasso teaches: the AI pushes on your thinking at every
            layer, but it never writes the conclusion for you. I built it as a
            student because the method changed how I made decisions, and there
            wasn&rsquo;t a good reason to keep it to myself.
          </p>
          <p
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              color: 'var(--ink-subtle)',
              marginTop: 20,
            }}
          >
            Created by Samir Sogani. Based on John Trapasso&rsquo;s classroom
            model, derived from the Paul&ndash;Elder model for critical thinking.
          </p>
        </article>
      </div>
    </section>
  )
}
