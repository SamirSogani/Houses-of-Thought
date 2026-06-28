export default function SheetStrip() {
  const sep = <span style={{ color: 'var(--rule)', margin: '0 6px' }}>/</span>

  return (
    <div className="sheet-strip">
      <div
        className="container"
        style={{
          display: 'flex',
          alignItems: 'center',
          fontFamily: 'var(--font-mono)',
          fontSize: 11,
          letterSpacing: '0.1em',
          textTransform: 'uppercase' as const,
          color: 'var(--ink-subtle)',
        }}
      >
        <span>
          Project · Houses of Thought {sep} Method · Trapasso / Paul–Elder {sep} Rev. A
        </span>
        <span style={{ marginLeft: 'auto' }}>Sheet 01 / Home</span>
      </div>
    </div>
  )
}
