// ProofStrip — continuous horizontal ticker showing system stats.
// Replaces the old SheetStrip's "PROJECT · METHOD · REV" with live-feeling
// system reporting: "47 REVIEW AGENTS · 9 STANDARDS · 8 LAYERS · FREE ALWAYS"

const items = [
  { text: '47', label: 'review agents' },
  { text: '9', label: 'intellectual standards' },
  { text: '8', label: 'reasoning layers' },
  { text: '3', label: 'perspectives per question' },
  { text: '∞', label: 'cited sources via research mode' },
  { text: '$0', label: 'forever — no paid tiers' },
]

function StripContent() {
  return (
    <>
      {items.map((item, i) => (
        <span key={i} className="proof-strip-item">
          <span className="accent">{item.text}</span>
          {item.label}
          <span className="proof-strip-dot" />
        </span>
      ))}
    </>
  )
}

export default function ProofStrip() {
  // Duplicate the content so the scroll loops seamlessly
  return (
    <div className="proof-strip" aria-hidden="true">
      <div className="proof-strip-track">
        <StripContent />
        <StripContent />
      </div>
    </div>
  )
}
