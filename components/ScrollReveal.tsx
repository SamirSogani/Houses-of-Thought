'use client'

// Scroll-reveal driver, written as progressive enhancement (seo #7, aeo M1).
//
// The CSS that hides sections is scoped to `.js-reveal` on <html>, which this
// component adds. So the reveal animation only exists when JS is running: with
// JS disabled or failed, and for crawlers that render-then-screenshot before
// hydration, the page is simply visible. Previously `[data-reveal]` was
// `opacity: 0` unconditionally, which left the h1-bearing intro sections of
// /how-it-works, /story, /faq and /educators blank without JS.

import { useEffect, useLayoutEffect } from 'react'
import { usePathname } from 'next/navigation'

// useLayoutEffect runs before paint (so the class lands before the first frame
// and revealed content doesn't flash in), but React warns when it runs during
// SSR — fall back to useEffect on the server, where neither one actually runs.
const useIsomorphicLayoutEffect = typeof window === 'undefined' ? useEffect : useLayoutEffect

export default function ScrollRevealInit() {
  const pathname = usePathname()

  useIsomorphicLayoutEffect(() => {
    document.documentElement.classList.add('js-reveal')
  }, [])

  // Re-run when the pathname changes so a client-side navigation between pages
  // that both render <ScrollRevealInit /> picks up the new page's [data-reveal]
  // elements. Without this, React reuses the component and the observer set up
  // for the old page's elements is disconnected while no new one is created.
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('revealed')
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.01 }
    )

    document.querySelectorAll('[data-reveal]').forEach((el) => observer.observe(el))
    return () => observer.disconnect()
  }, [pathname])

  return null
}
