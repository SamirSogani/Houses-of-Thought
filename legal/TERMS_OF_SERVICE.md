# Terms of Service — Houses of Thought

<!-- TODO: Effective date -->
**Effective date:** [DATE]

<!-- TODO: Legal entity name operating the service -->
These Terms of Service ("Terms") are an agreement between you and [COMPANY LEGAL NAME] ("we," "us"), the operator of Houses of Thought (the "Service"), available at the Service's website. By creating an account or using the Service, you agree to these Terms.

## 1. The Service

Houses of Thought is an educational tool for building structured reasoning frameworks called "houses." A house organizes your thinking on a question across layers such as concepts, perspectives, evidence, assumptions, and implications, and computes a deterministic "House Strength" score from the content you enter.

The Service includes:

- **The builder**, available both signed in (work is saved to your account) and without an account at the public builder page, where work is stored only in your own browser's local storage and is not transmitted to or saved on our servers.
- **An AI co-pilot** (Section 5) that offers suggestions, Socratic questions, critiques, and research assistance while you build.
- **A "Mini House" demo** that generates a small sample framework from a question you type, without an account. Demo output is not saved to our servers.
- **Classroom features** (Section 6) for teacher and student accounts.

## 2. Accounts

- You register with an email address and a password (minimum 8 characters). Authentication is provided through our infrastructure provider, Supabase.
- At signup you choose an account type — Standard, Student, or Teacher — which determines what the Service lets you do. Student accounts use the AI co-pilot in "Learn" (Socratic questioning) mode only; Teacher accounts can create classes and view work students submit to their classes.
- You are responsible for the security of your credentials and for activity under your account. Notify us promptly of any unauthorized use.
- You must provide accurate information. Do not select the Teacher account type unless you are, in fact, an educator or acting in an instructional role: the Teacher type grants access to student work submitted to your classes.

### Age and school use

<!-- TODO: Set the minimum age and the under-13 / student-consent policy. The product is designed for classroom use by students, so COPPA (US) and equivalent rules likely apply; counsel should decide whether school consent (e.g., COPPA's school-official exception) or parental consent is required, and this section must be rewritten accordingly. -->
You must be at least [MINIMUM AGE] to create an account, or use the Service under the supervision and with the consent of your school and, where required, a parent or guardian.

### Account deletion

Self-service account deletion is not yet available in the product. To request deletion of your account and associated data, contact us at [CONTACT EMAIL]. <!-- TODO: Contact email; also update this section when in-product deletion ships -->

## 3. Free service

The Service is currently offered free of charge. There are no paid tiers, subscriptions, or in-product purchases, and we do not collect payment information. If we introduce paid features in the future, we will publish separate pricing and payment terms and give you notice before anything you currently use becomes paid.

## 4. Your content

- **Ownership.** You retain all rights to the content you create in the Service — your houses, their contents, assignment responses, profile information, and anything you type into the AI co-pilot ("Your Content").
- **License to us.** You grant us a non-exclusive, worldwide, royalty-free license to host, store, reproduce, process, and display Your Content solely as needed to operate and provide the Service — for example, saving your houses, showing submitted work to your teacher, and sending relevant content to AI providers as described in Section 5.
- **Visibility.** Houses you build while signed in are private to your account, except that work you associate with a class assignment is visible to that class's teacher as described in Section 6. The Service does not currently offer public publishing or sharing of houses outside the classroom mechanism (see Section 7).
- **Responsibility.** You are solely responsible for Your Content and must have the rights to anything you submit.

## 5. AI features

The Service includes AI features powered by third-party large language model providers. Requests are routed among multiple providers — currently including Mistral, Groq, Google (Gemini), Cerebras, and OpenRouter — based on availability and request size. Content you submit to an AI feature (your house content, your question, or your interview answers) is sent to one or more of these providers to generate a response. Research features additionally send a search query to Brave Search to retrieve live web results.

What the AI features do:

- **Suggestions and critique.** The co-pilot suggests content for the layer you are working on and, at the review stage, critiques your house against intellectual standards. Suggestions are candidates only: nothing is added to your house unless you explicitly accept it, and AI commentary never affects the deterministic House Strength score.
- **Context interview.** An optional interview asks you questions to build a working context for the co-pilot. Only the distilled summary and facts are saved with your house; the interview transcript itself is not stored on our servers.
- **Research mode.** Candidate evidence is drawn from live Brave Search results, and every candidate links to a real URL returned by that search. We do not guarantee the accuracy of third-party sources.
- **Strawman exercises (classrooms).** Where a teacher enables it for an assignment, the Service generates a deliberately flawed argument for students to critique. This content is intentionally incorrect by design and is released by the teacher, not shown to students automatically.
- **Mini House demo.** Generates a small sample framework, with citations grounded in live search results, for anyone without an account.

**AI disclaimers.** AI-generated output may be inaccurate, incomplete, biased, or misleading, even when it cites sources. It is provided for educational and brainstorming purposes only and is not professional, legal, medical, financial, or academic advice. You are responsible for evaluating AI output before relying on it or adding it to your work.

**Usage limits.** AI features are rate-limited per day (currently a lower cap for anonymous visitors and a higher cap for signed-in users; limits may change). To enforce the anonymous cap we set a strictly necessary, randomly generated first-party cookie in your browser (falling back to a one-way hash of your IP address if the cookie cannot be used); it is not used for tracking or analytics. Circumventing rate limits is prohibited.

## 6. Classrooms

- **Classes and join codes.** Teachers can create classes, each with a join code. Anyone signed in who enters a valid join code (including via a `/join/<code>` link) becomes a member of that class. Treat join codes with care: share them only with the intended students, since possession of the code is what grants membership.
- **What teachers see.** A class's teacher can see the class roster (each member's username or, absent one, a label derived from their email address) and the houses students build for that class's assignments, including whether work is turned in.
- **Assignments and feedback.** Teachers can post assignments (optionally grouped into courses, with due dates), configure the co-pilot mode for an assignment, enable strawman exercises, and record written feedback on submitted work, which the submitting student can see.
- **Student accounts.** Student accounts are pinned to the co-pilot's Learn posture: the AI asks questions and coaches, and does not draft content for the student.
- If you use the Service on behalf of a school or institution, you are responsible for ensuring your use (including collecting student work) complies with applicable education-privacy law and your institution's policies.

## 7. Features not yet available

In the interest of accuracy: some controls visible in the builder interface are previews and do not currently perform the action they describe. In particular, the builder's "invite co-builder" and "publish" controls do not send invitations, grant anyone access to your house, or make it public — the only working sharing mechanism today is the classroom join-code flow in Section 6. Collaborator names and activity shown in the builder's team panel are illustrative demo content, not real users. Likewise, in-product account deletion is not yet functional (see Section 2). We will update these Terms as such features ship.

## 8. Acceptable use

You agree not to:

- Break the law, infringe others' rights, or submit content you have no right to submit;
- Harass, threaten, or harm others, including other members of a class;
- Misrepresent your identity or account type, or join a class you were not invited to join;
- Attempt to access other users' accounts, houses, or data, or probe, bypass, or interfere with authentication, row-level security, rate limits, or the admin interface;
- Abuse the AI features, including attempting to circumvent usage caps (for example by rotating identifiers), using the Service to generate unlawful or harmful content, or reselling AI access;
- Scrape, overload, disrupt, or reverse engineer the Service, or use it to build a competing dataset;
- Use the Service to cheat where doing so violates your school's academic-integrity rules.

We may throttle, suspend, or remove content or accounts that violate this section.

## 9. Operations and administration

We use a limited administrative interface to monitor the health of the AI providers described in Section 5 (availability, error rates, latency). We also use hosting analytics to understand aggregate usage of the Service. For details on the data we collect and how we use it, see our Privacy Policy. <!-- TODO: Link the Privacy Policy once it exists -->

## 10. Termination

- You may stop using the Service at any time and may request account deletion under Section 2.
- We may suspend or terminate your access, or discontinue the Service or any feature, at any time, with or without notice, including for violation of these Terms. Where practical we will give reasonable notice of discontinuation so you can retrieve Your Content.
- Sections that by their nature should survive termination (including Sections 4, 11, 12, and 13) survive.

## 11. Disclaimers

THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTIES OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, ACCURACY, OR UNINTERRUPTED AVAILABILITY. WITHOUT LIMITING THE FOREGOING, WE DO NOT WARRANT THE ACCURACY OF AI-GENERATED OUTPUT, HOUSE STRENGTH SCORES, OR THIRD-PARTY SEARCH RESULTS, AND WE DO NOT WARRANT THAT DATA (INCLUDING WORK STORED ONLY IN YOUR BROWSER'S LOCAL STORAGE) WILL NOT BE LOST.

## 12. Limitation of liability

TO THE MAXIMUM EXTENT PERMITTED BY LAW, WE WILL NOT BE LIABLE FOR ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, OR ANY LOSS OF DATA, PROFITS, OR GOODWILL, ARISING FROM OR RELATED TO THE SERVICE. TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR TOTAL AGGREGATE LIABILITY FOR ALL CLAIMS RELATING TO THE SERVICE WILL NOT EXCEED THE GREATER OF (A) THE AMOUNTS YOU PAID US FOR THE SERVICE IN THE TWELVE MONTHS BEFORE THE CLAIM (CURRENTLY ZERO, AS THE SERVICE IS FREE) AND (B) FIFTY US DOLLARS (US$50). SOME JURISDICTIONS DO NOT ALLOW CERTAIN LIMITATIONS, SO PARTS OF THIS SECTION MAY NOT APPLY TO YOU.

## 13. Indemnification

You will indemnify and hold us harmless from claims arising out of Your Content, your use of the Service, or your violation of these Terms, to the extent permitted by applicable law.

## 14. Changes to the Service and these Terms

We may modify the Service and these Terms. For material changes to these Terms we will provide notice (for example, by posting in the Service or emailing the address on your account) before the changes take effect. Continued use after the effective date of a change constitutes acceptance.

## 15. Governing law and disputes

<!-- TODO: Governing jurisdiction/state and venue; counsel to decide on arbitration/class-waiver language, especially given student users -->
These Terms are governed by the laws of [JURISDICTION], without regard to conflict-of-laws rules. Disputes will be resolved in the courts of [VENUE], and each party consents to their jurisdiction.

## 16. General

These Terms are the entire agreement between you and us regarding the Service. If any provision is unenforceable, the remainder stays in effect. Our failure to enforce a provision is not a waiver. You may not assign these Terms without our consent; we may assign them in connection with a merger, acquisition, or sale of assets.

## 17. Contact

<!-- TODO: Contact email -->
<!-- TODO: Registered business address -->
Questions about these Terms: [CONTACT EMAIL]
[COMPANY LEGAL NAME], [REGISTERED ADDRESS]
