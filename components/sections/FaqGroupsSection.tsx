'use client'

import { useState } from 'react'
import { ChevronIcon } from '@/components/icons'

type FaqItem = { question: string; answer: string }
type FaqGroup = { label: string; items: FaqItem[] }

const groups: FaqGroup[] = [
  {
    label: 'The basics',
    items: [
      {
        question: 'What is Houses of Thought?',
        answer:
          "It's a tool for building structured, defensible reasoning. You work a hard question into a house of layers: concepts, perspectives, evidence, assumptions, and a conclusion. By the end you have an answer you can explain and stand behind.",
      },
      {
        question: 'Who is it for?',
        answer:
          "Educators and students come first, since it's built for classrooms. It also works for anyone facing a hard decision, and for debate students who want a rigorous way to reason through a question.",
      },
      {
        question: 'Do I need an account to try it?',
        answer:
          'No. You can try it free with no login, and your work saves locally in your browser. When you create an account, that work carries over.',
      },
    ],
  },
  {
    label: 'How it works',
    items: [
      {
        question: 'What exactly is a "house"?',
        answer:
          'A reasoning structure you build in layers, from foundation to roof. The layers run from concepts and the overarching question up through perspectives, evidence, assumptions, your conclusion, and its implications. Each layer rests on the ones below it.',
      },
      {
        question: 'What is House Strength?',
        answer:
          'A score that reads your reasoning across three axes: evidence, logic, and coverage. It rolls up into one overall number. Use it to find the thin spots in a house and decide where to strengthen it.',
      },
      {
        question: 'What is Research Mode?',
        answer:
          'A mode where the AI helps you gather evidence and cites the sources it uses. Every fact in your house links back to something you can open and check for yourself.',
      },
    ],
  },
  {
    label: 'AI & accuracy',
    items: [
      {
        question: 'What does the AI do, and what does it not do?',
        answer:
          'It asks sharpening questions, surfaces perspectives you may have missed, gathers cited evidence, and stress-tests your conclusion once you reach one. It will not write that conclusion for you. In student mode the assistant steps back further and leaves the reasoning to you.',
      },
      {
        question: 'How do you prevent hallucinated sources?',
        answer:
          'Research Mode grounds each claim in a retrieved source, and every citation links to the original so you can read it yourself. When the AI is unsure, it flags that rather than stating it as fact. You can always see where a claim came from.',
      },
      {
        question: 'Can I trust the conclusions?',
        answer:
          "The conclusion is one you build, so trusting it is your call. House Strength shows how well it holds up across evidence, logic, and coverage, and the Stress Test points out where it's thin. Together they give you a clear read on how far your own reasoning goes.",
      },
    ],
  },
  {
    label: 'Classrooms & teachers',
    items: [
      {
        question: 'How do students join a class?',
        answer:
          "Through a teacher's join link or class code. They land straight in the assigned house with no separate setup. Students under 12 only ever join through a teacher-managed classroom.",
      },
      {
        question: 'Do students get the AI assistant?',
        answer:
          "In student mode the co-reasoning assistant steps back, so the thinking stays the student's own work. Students still get the full builder, Research Mode with cited sources, House Strength scoring, and the Stress Test.",
      },
      {
        question: 'Is student work private?',
        answer:
          "Yes. Student work stays private to the classroom, and teachers control the roster. We don't sell student data or train public models on it. Our Privacy and Terms cover the full detail.",
      },
    ],
  },
  {
    label: 'Pricing & account',
    items: [
      {
        question: 'How much does it cost?',
        answer:
          "It's free to start, with no paywall in the way of trying it or building your first houses. Detailed plans for classrooms and heavier use will be published once they're finalized.",
      },
      {
        question: 'What happens to my local work when I sign up?',
        answer:
          'It carries into your new account. Any house you built before signing up comes with you, so creating an account never costs you work.',
      },
      {
        question: "What's the minimum age?",
        answer:
          'Individual accounts are for ages 12 and up. Younger students take part only through a teacher-managed classroom, never with their own account.',
      },
    ],
  },
]

function AccordionItem({
  item,
  isLast,
  defaultOpen,
}: {
  item: FaqItem
  isLast: boolean
  defaultOpen: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div
      style={{
        borderTop: '1px solid var(--rule)',
        borderBottom: isLast ? '1px solid var(--rule)' : undefined,
      }}
    >
      <button
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        style={{
          width: '100%',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 16,
          padding: '20px 0',
          textAlign: 'left',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 500,
            fontSize: 20,
            color: 'var(--ink)',
          }}
        >
          {item.question}
        </span>
        <span
          style={{
            color: 'var(--ink-subtle)',
            flexShrink: 0,
            transform: open ? 'rotate(180deg)' : 'none',
            transition: 'transform 0.24s',
          }}
        >
          <ChevronIcon />
        </span>
      </button>
      <div
        style={{
          display: open ? 'block' : 'none',
          padding: '0 0 22px',
        }}
      >
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 16,
            lineHeight: 1.65,
            color: 'var(--ink-mid)',
            maxWidth: '64ch',
          }}
        >
          {item.answer}
        </p>
      </div>
    </div>
  )
}

export default function FaqGroupsSection() {
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
        style={{ maxWidth: 820, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 56 }}
      >
        {groups.map((group) => (
          <div key={group.label} data-reveal>
            <p
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 12,
                fontWeight: 500,
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                color: 'var(--amber-hover)',
                marginBottom: 8,
              }}
            >
              {group.label}
            </p>
            <div>
              {group.items.map((item, i) => (
                <AccordionItem
                  key={item.question}
                  item={item}
                  isLast={i === group.items.length - 1}
                  defaultOpen={i === 0}
                />
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
