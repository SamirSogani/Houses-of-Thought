// The FAQ content, extracted from the accordion component so the /faq page can
// emit FAQPage JSON-LD from the SAME array it renders (seo #9, aeo H2). One
// source of truth: an answer edited here updates both the page and the
// structured data, so they can never disagree.

import type { ReactNode } from 'react'

export type FaqItem = {
  question: string
  /** Plain-text answer, used for JSON-LD structured data. */
  answer: string
  /** Optional rich answer with links/markup, rendered in place of `answer`
   *  when present. The plain `answer` still drives the JSON-LD. */
  richAnswer?: ReactNode
}
export type FaqGroup = { label: string; items: FaqItem[] }

export const faqGroups: FaqGroup[] = [
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
          "No. You can build a Mini House free with no login. Mini House results aren't saved, though. Create a free account when you want the full builder, where every house autosaves to your dashboard.",
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
          'A structural score across three axes: evidence, logic, and coverage. It measures how complete each layer of the house is (sourced evidence, surfaced assumptions, range of perspectives) and rolls up into one overall number. Use it to find the thin spots and decide where to strengthen.',
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
        question: 'How is this different from ChatGPT?',
        answer:
          'ChatGPT gives you one answer. Houses of Thought walks seven layers of structured reasoning — perspectives, evidence, assumptions, and a conclusion — and checks six of those layers against nine independent standards before the run moves on. You see the thinking, not just the output. See the full comparison at /compare.',
        richAnswer: (
          <>
            ChatGPT gives you one answer. Houses of Thought walks seven layers of
            structured reasoning — perspectives, evidence, assumptions, and a
            conclusion — and checks six of those layers against nine independent
            standards before the run moves on. You see the thinking, not just the
            output.{' '}
            <a href="/compare" style={{ color: 'var(--amber-text)', fontWeight: 600 }}>
              See the full comparison →
            </a>
          </>
        ),
      },
      {
        question: 'What does the AI do, and what does it not do?',
        answer:
          'It asks sharpening questions, surfaces perspectives you may have missed, gathers cited evidence, and stress-tests your conclusion once you reach one. It will not write that conclusion for you. Student accounts run the co-pilot in Learn mode, where it coaches with Socratic questions instead of making suggestions.',
      },
      {
        question: 'How do you prevent hallucinated sources?',
        answer:
          'Research Mode only cites sources it actually retrieved in the same search (the AI cannot attach a URL it did not just find), and every citation links to the original so you can read it yourself. AI output can still be wrong, which is why every claim stays inspectable instead of taken on faith.',
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
          "With a join link or class code from their teacher. A student creates a free student account, redeems the code, and the class and its assignments appear under Classes.",
      },
      {
        question: 'Do students get the AI assistant?',
        answer:
          "Student accounts run the co-pilot in Learn mode: it coaches with Socratic questions instead of making suggestions, so the thinking stays the student's own work. Students still get the full builder, Research Mode with cited sources, House Strength scoring, and the Stress Test.",
      },
      {
        question: 'Is student work private?',
        answer:
          "Yes. Student work stays private to the classroom, and teachers control the roster. We don't sell student data and don't use it for advertising. Our Privacy and Terms pages cover the full detail.",
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
        question: 'Is my work saved before I sign up?',
        answer:
          "Mini House results from the free try page aren't saved; they live only in that browser session. A free account unlocks the full builder, where every house autosaves to your dashboard as you work.",
      },
      {
        question: "What's the minimum age?",
        answer:
          'You must be at least 13 to create an account. Support for younger classrooms through school-managed consent is on the roadmap, but not available yet.',
      },
    ],
  },
]
