# Site-wide Copy Consistency Review — Houses of Thought

**Auditor:** content-consistency-editor (general-purpose subagent, model: fable)

Scope reviewed: all marketing pages under `app/` (home, how-it-works, educators, story, faq, examples, try), in-app copy (`components/`, `lib/build/`, `lib/profile/`), and `legal/TERMS_OF_SERVICE.md` + `legal/PRIVACY_POLICY.md`. Seed issues from the earlier audit ("Attack Mode" vs "Stress Test", "House of Thought" vs "House of Reason") were re-checked: the first is resolved (no "Attack Mode" anywhere; "Stress Test" is now near-uniform), the second survives only as an intentional lineage credit — but new, worse inconsistencies exist.

## CRITICAL — broken contact / trust-damaging

**C1. There is no working contact channel anywhere in the product, yet both legal docs depend on one.**
- `legal/TERMS_OF_SERVICE.md` (lines 34, 128) and `legal/PRIVACY_POLICY.md` (line 313): contact email is still the literal placeholder `[CONTACT EMAIL]`. Account deletion in both documents is "contact us" — currently impossible.
- `components/sections/Footer.tsx` line 29 and `components/Header.tsx` line 282 link "Contact" to `/contact`; `app/educators/page.tsx` line 32 links "Talk to us" to `/contact`. **No `/contact` route exists in `app/`.**
- The only email address in the entire repo is the fake input placeholder `maya@school.edu` (`components/build/InviteModal.tsx:58`).
- Recommended single source of truth: pick one canonical support address, put it in ToS §2/§17 and Privacy §10, and either create `/contact` or point those three links at a `mailto:`. Until then the "request deletion by contacting us" promise in Privacy §5/§8 is unfulfillable.

**C2. Legal documents still contain shipping-blocking placeholders.** `[DATE]`, `[COMPANY LEGAL NAME]`, `[MINIMUM AGE]`, `[JURISDICTION]`, `[VENUE]`, `[REGISTERED ADDRESS]`, plus HTML `<!-- TODO -->` comments (ToS lines 3–7, 29, 34, 117, 126–129; Privacy lines 3–14, 312–317). Also ToS §9: "see our Privacy Policy `<!-- TODO: Link the Privacy Policy once it exists -->`" — it now exists in the same directory and should be cross-linked. And neither doc is reachable from the site: Footer and `EducatorTrustSection.tsx` (lines 64–65) link `/terms` and `/privacy`, **routes that do not exist**.

**C3. Minimum age: 12 vs 13, and a consent mechanism that doesn't exist.**
- FAQ (`FaqGroupsSection.tsx:106`): "Individual accounts are for ages 12 and up. Younger students take part only through a teacher-managed classroom, never with their own account." Same claim at line 76 ("Students under 12 only ever join through a teacher-managed classroom") and `EducatorTrustSection.tsx:6` ("Accounts are 12+…").
- Privacy Policy §7: "Children under 13 may not create accounts" and — explicitly — "Teachers do **not** create accounts on students' behalf." There is no teacher-managed-account mechanism in the product; students self-register (confirmed in `app/login/page.tsx`, which has no age gate and no ToS acceptance).
- ToS still says `[MINIMUM AGE]`.
- Two different ages and a nonexistent under-age pathway are being promised to schools. Single source of truth: Privacy §7 (13, no under-13 self-registration, school consent handled off-product). Marketing must change to match or the product/legal position must change first.

**C4. "We don't train models on student data" — a claim the Privacy Policy explicitly says not to make yet.**
- FAQ (`FaqGroupsSection.tsx:86`): "We don't sell student data or train public models on it." `EducatorTrustSection.tsx:10`: "We don't sell data or train public models on it."
- Privacy §2 TODO (lines 124–127): "Confirm with counsel/vendors that none of the listed AI providers use API traffic for model training … before adding any 'not used for training' claim. The code does not and cannot guarantee vendor-side behavior."
- Marketing is already making the claim legal refused to make. Recommended: soften marketing to the Privacy Policy's verified language ("we don't sell personal information and don't use it for advertising") until vendor terms are confirmed.

**C5. "Your local work carries over when you sign up" — feature does not exist.**
- FAQ: "When you create an account, that work carries over" (line 26) and "It carries into your new account. Any house you built before signing up comes with you, so creating an account never costs you work" (line 101).
- Code: `lib/build/persistence.ts` (`LOCAL_HOUSE_KEY`) is only read by the anonymous `/house` page; `app/build/page.tsx` creates a **blank** house on signup — no migration path exists anywhere. ToS §1 correctly says anonymous work "is stored only in your own browser's local storage and is not transmitted to or saved on our servers."
- Recommended: delete/soften both FAQ answers (or build the migration). The repeated CTA note "Your work saves locally until you create an account" (`FinalCtaSection.tsx`, and CTASection notes on how-it-works/faq/examples) also implies carryover and should be reworded.

## HIGH — claims contradicting the Terms of Service (which is the honest document)

**H1. Publish / export / invite / presence are sold as working; ToS §7 says they're inert previews.** ToS §7: the "invite co-builder" and "publish" controls "do not send invitations, grant anyone access to your house, or make it public," and team-panel collaborators are "illustrative demo content, not real users." Contradicted by:
- `HowOutcomeSection.tsx:24-25`: "From there you can publish it, export it, or hand it in" (+ Publish / Export PDF / Hand in chips).
- `HowCollaborationSection.tsx:53-56`: "Invite co-builders and give each of them a perspective to own…"
- `components/build/WhatsNewDrawer.tsx` via `lib/build/content.ts:289`: "Invite co-builders, assign perspectives, **see live presence**…" — in-app copy.
- `MiniHouseResult.tsx:359`: "All your Houses saved, **versioned, and shareable**" — no versioning or sharing exists.
- Worst: the builder's own toasts assert success for actions that did nothing — `lib/build/state.ts:395` "House published · strength N", `:398` "Exported as PDF", `:386` "Invite link copied". `lib/build/content.ts:67` labels step 7 "Score & publish". The fake collaborators "Maya R." / "Devan K." with fake activity timestamps (`lib/build/people.ts:24-26`) carry no "demo" label in the UI.
- Recommended source of truth: ToS §7. Either mark these controls as previews in the UI and cut the marketing claims, or ship the features.

**H2. Classroom peer review claimed; Privacy says students can't see each other's work.** `EducatorCollabSection.tsx:20-23`: "Inside classrooms, collaboration means real people: teacher-to-student feedback **and peer review on a shared house** … We only claim what exists today." Privacy §1.4: "Students in a class cannot see each other's roster entries or houses." The sentence that boasts about only claiming what exists contains a claim that doesn't exist.

**H3. Three contradictory descriptions of the student-account AI.**
- Educators page (`EducatorDifferenceSection.tsx`): "Assistant **off**", "co-reasoning assistant **switched off** on purpose".
- FAQ (`:56, :81`) and how-it-works (`HowAiRoleSection.tsx:14`): assistant "steps back" / "steps back **entirely**".
- Product + legal (the truth): ToS §2/§6, signup selector (`lib/profile/data.ts:22-24`: "The AI co-pilot works in Learn mode only: it coaches with Socratic questions"), `ContextBar.tsx:125` ("Student accounts stay in Learn mode"), decision 007. The AI is active for students — Socratic, not absent.
- Recommended single source of truth: the Learn-mode wording from `lib/profile/data.ts` / ToS §2. "Assistant off" on the educators page is factually wrong and undersells the product; "steps back entirely" is also wrong.

**H4. Broken CTA routes (copy pointing at pages that don't exist).**
- `/framework`: Footer, mobile nav, CTASection on how-it-works and story ("Read the framework"), and `HowBuildFlowSection.tsx:151` "Full model at /framework". No such page.
- `/signup` and `/signup?role=educator`: `FinalCtaSection.tsx:39`, `EducatorHeroSection.tsx:55`, educators CTA. The real signup route is `/login?mode=signup` (used correctly by `MiniHouseResult.tsx:294`). Two different signup URLs, one of which 404s.
- `/forgot-password`: linked from `app/login/page.tsx:256`; no route.
- `/terms`, `/privacy`, `/contact`: see C1/C2.

**H5. "Students land straight in with no separate setup."** FAQ `:76` and `EducatorClassroomSection.tsx:5` ("nothing to set up on their end") vs ToS §6 / Privacy §7: a student must create their own account (email + password + account type) and then redeem the join code. Overclaim; align with the legal description.

## MEDIUM — terminology drift

**M1. The score has two names.** Canonical everywhere (legal §1, FAQ, builder, examples): **"House Strength."** Deviations: `EducatorDifferenceSection.tsx:6` "**Logic Strength** & Stress Test" and `MiniHouseResult.tsx:358` "**Logic Strength Meter** + Reasoning Stress Tests." "Logic" is also one of House Strength's three sub-axes (Evidence/Logic/Coverage), so "Logic Strength" actively misnames the whole score as one of its parts. Fix both to "House Strength."

**M2. The AI has at least five names.** "AI co-pilot" (ToS §1/§5, signup selector, builder UI tab "Co-pilot"), "co-reasoning assistant" (FAQ, educators), "**Collab** AI assistant" / "Collab" as a noun (`EducatorDifferenceSection.tsx:7,12`, `DifferentiatorSection.tsx:4` "Collab means you reason with the AI", `app/welcome/page.tsx:43` "Your Collab workspace", `EducatorCollabSection` "the individual Collab builder"), "AI Sidebar" (`MiniHouseResult.tsx:357`), and generic "assistant". "Collab" never appears in the actual product UI and reads as a different product. Recommended canonical: **co-pilot** (matches product UI and both legal docs); allow "AI co-pilot" on first mention.

**M3. Three incompatible "7 layers."**
- Marketing house diagram (`InteractiveHouseSection`, `HowBuildFlowSection`): Concepts, Question, Perspectives, Evidence, Assumptions, Conclusion, Implications.
- Builder's actual 7 steps (`lib/build/content.ts`): Frame (concepts+question combined), Perspectives, Evidence, Assumptions, Conclusion, Implications, **Review**.
- Examples detail page jump list: Frame … House strength.
- Home says "Three steps," how-it-works says "five moves," both mapping onto "7 layers" differently. The steps/moves framing is arguably intentional summarization (ToS §1's "layers such as…" hedge is compatible with all of them), but a user who counts will find the marketing diagram and the builder disagree about what the seven layers are. Recommend aligning the builder's step names with the marketing diagram or vice versa.

**M4. Three different "perspectives" schemes presented as canonical.** `InteractiveHouseSection.tsx:21` defines Perspectives as "Three lenses on the question (**Self, Group, and Ideas**)" (echoed in `ProblemSection.tsx:123` "Self · Group · Ideas") — this triad appears nowhere in the product. The builder and all examples use stakeholder perspectives (Students/Teachers/Parents/…); the Mini House uses Practical/Emotional/Long-Term. Recommend the home page describe perspectives as stakeholder lenses, matching the product.

**M5. Home-page teaser misdescribes the example it links to — numbers swapped.** `ExampleTeaserSection.tsx:87-88`: "Three stakeholder perspectives, six cited sources." The actual `should-ai-be-used-in-schools` house (`lib/build/state.ts`) has **six perspectives and three cited sources**. The teaser's per-perspective question counts (6/8/5) don't match the data (3/3/2), and its hardcoded scores (75; 82/76/68) risk drifting from the detail page, which computes strength live. The adjacent `ProblemSection` mock shows the same Strength-75 house with "4 cited." Derive the teaser from `lib/examples/data.ts` or correct the copy.

**M6. Framework naming — mostly resolved, one nit.** "House of Reason" survives only in `OriginQuoteSection.tsx:22` as an attributed lineage credit, which `context/vision/product-strategy.md:75` explicitly permits ("Retire 'House of Reason' except as a…"). Intentional and explained — no action. Nit: "Paul–Elder **model**" (OriginQuote) vs "Paul–Elder **Model**" (StoryChaptersSection lines 90, 115); pick one casing.

**M7. Pricing tone mismatch (not a contradiction, but drift).** ToS §3: flatly free, "no paid tiers." FAQ `:96`: "free **to start** … Detailed plans for classrooms and heavier use will be published once they're finalized" — implies imminent pricing; educators CTA "Free to start." Also MiniHouse CTA "Create a free account to … **unlock the AI tools**" undersells that anonymous users already get rate-limited AI (ToS §5). Align on "free, with notice before anything becomes paid" (ToS language).

**M8. FAQ overpromises AI honesty.** `FaqGroupsSection.tsx:61`: "When the AI is unsure, it flags that rather than stating it as fact." ToS §5 disclaimer: output "may be inaccurate … **even when it cites sources**." The FAQ makes a behavioral guarantee the Terms disclaim; soften the FAQ.

## LOW — leftover text, typos, polish

**L1. Literal "Placeholder" shipped to users.** `app/welcome/page.tsx:17` — the post-signup welcome page's eyebrow text is the word "Placeholder". Also uses the "Collab workspace" naming (M2).

**L2. Internal note on a public page.** `EducatorTrustSection.tsx:71-72` renders "COPPA / FERPA review pending. Copy here will be finalized against policy before launch." to visitors. Honest, but it's a production page telling schools the compliance copy above it isn't final — either intentional radical transparency or a leftover; flag for a decision.

**L3. Broken sentence in Mini House empty state.** `MiniHouseResult.tsx:170-171`: "A full House runs deeper, cited research with real citations." — garbled grammar plus "cited … citations" redundancy. Suggest: "A full House runs deeper research, with real citations."

**L4. Founder's name as the default profile username.** `lib/profile/data.ts` `initialProfile.username: 'Samir_sogani'` — a personal leftover that becomes every user's default profile value while the profile page runs on local state.

**L5. Duplicate sheet numbers.** The blueprint conceit assigns "Sheet 07" to both Our Story (`app/story/page.tsx`) and Examples (`app/examples/page.tsx`, `[slug]`); Try is "Sheet 00", Footer "Sheet 99". Renumber one of the 07s.

**L6. House-capitalization and em-dash drift.** "house"/"House"/"Houses" alternate ("How a House gets built", "Full Houses", "your house"); `lib/build/content.ts:2` states a brand rule — "No em-dashes in user-facing copy" — violated by `TryItFlow.tsx:157`, `MiniHouseResult.tsx:121`, and the `<title>` strings in `app/layout.tsx:28` / `app/try/page.tsx:8`. Minor, but it's their own stated rule.

**L7. ToS §1 layer list omits Question/Conclusion** ("layers such as concepts, perspectives, evidence, assumptions, and implications") — the "such as" hedge makes it defensible, but adding "question" and "conclusion" would match every other surface.

## What checked out clean

- "Stress Test" naming is consistent across FAQ, how-it-works, differentiator, and educators pages (no "Attack Mode" remnants).
- House Strength's three axes are "Evidence, Logic, Coverage" identically on home, how-it-works, FAQ, examples, and in the builder (`axisMeasures`).
- Legal AI-provider list (Mistral, Groq, Google Gemini, Cerebras, OpenRouter, Brave Search) matches the routing code, and the only provider marketing names — Brave Search (`MiniHouseResult.tsx:356`) — matches Privacy §3.
- The interview-transcript claim ("only the distilled summary is saved") is consistent between ToS §5, Privacy §1.5, and the intake design in decision 015.
- Footer copyright "© 2026" is current.

## Top 5 fixes by trust impact

1. Create the contact channel and fill `[CONTACT EMAIL]` in both legal docs; create or redirect `/contact`, `/terms`, `/privacy` (C1, C2).
2. Resolve the age policy to one number (13, per Privacy) and delete the nonexistent "teacher-managed classroom for under-12s" pathway from FAQ and educators pages (C3).
3. Remove the "don't train models on it" and "work carries over" claims until they're true (C4, C5).
4. Stop the product lying to itself: fix "House published" / "Exported as PDF" toasts and the publish/invite marketing copy to match ToS §7, or label them previews (H1).
5. Standardize on "House Strength," "co-pilot," and the Learn-mode description of student AI across educators page, FAQ, and Mini House (M1, M2, H3).
