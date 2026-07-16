# Privacy Policy — Houses of Thought

<!-- TODO: Effective date -->
**Effective date:** [DATE]

<!-- TODO: Company/entity legal name -->
This Privacy Policy describes how **[ENTITY LEGAL NAME]** ("we," "us," "our")
collects, uses, and shares information when you use Houses of Thought (the
"Service"), a web application for building structured reasoning ("houses"),
individually or in a classroom setting.

<!-- TODO: This policy was drafted from the product's source code as of July 2026.
It must be reviewed by qualified legal counsel before publication, particularly
the COPPA/FERPA sections. -->

---

## 1. Information We Collect

### 1.1 Account information

When you create an account, we collect through our authentication provider
(Supabase):

- **Email address** and a **password** (the password is handled by Supabase
  Auth; we never store it in plaintext).
- **Account type** — you choose one of *Standard*, *Student*, or *Teacher* at
  signup.

We do **not** collect your name, date of birth, or age at signup, and the
Service does not currently verify age (see Section 7 on children's privacy).

### 1.2 Profile information (optional, user-provided)

On your profile page you may choose to provide:

- A **username** (publicly unique within the Service).
- **"About me"**, **current project**, **role**, and **location** free-text
  fields.
- Four **"perspectives"** fields (*biological, social, familial, individual*)
  describing your personal background and viewpoint. These are reflective,
  free-text fields; depending on what you write, they may contain sensitive
  personal information. You control what, if anything, you enter here.

### 1.3 Your houses (reasoning content)

The core of the Service is content you create in the house builder. For each
house we store: a title, the question it addresses, concepts, watchpoints,
perspectives (name, summary, strength), evidence items (text, source, and
optionally a citation URL), assumptions, implications, the house's mode
(Learn/Decide), status and completion progress, timestamps, and — if you use
the AI context interview — a **distilled AI context** (a short summary plus a
list of facts you shared; see Section 1.5).

If you use the builder **without an account** (the open `/house` and `/try`
pages), your house content is stored only in your browser's local storage on
your device, not on our servers — except when you invoke an AI feature, in
which case the content is sent to our servers and AI providers for processing
(Section 3) but is not saved to our database.

### 1.4 Classroom and roster information

If you use classroom features:

- **Teachers** create classes (class name) and receive a short shareable
  **join code**. Teachers also create assignments (question text, mode, due
  date, optional "strawman" generation settings such as an intended grade
  level and audience age — these describe the assignment, not any specific
  student) and may record **written feedback and a grade** on each student's
  submission.
- **Students** join a class by entering or following a join code. We store the
  class membership (which class, which user, role, join date).
- **Teacher visibility:** a teacher of your class can see the class roster
  (your username, email address, and join date) and has **read-only** access
  to the houses you own, including houses created for that teacher's
  assignments and self-started houses. Teachers cannot edit your house
  content; they can only add feedback and a grade in a separate record.
- Students in a class cannot see each other's roster entries or houses.

### 1.5 AI interview transcripts and AI interactions

The AI co-pilot's **context interview** asks you questions to understand your
situation. The running transcript of that conversation is processed
**ephemerally**: it is sent to our AI providers to generate the next question
and, at the end, a distilled context (summary + facts). Only the distilled
context is saved to your house; **the full transcript is not stored in our
database**. Other AI features (suggestions, critique, research, strawman
generation) similarly send your current house content for processing and
return results without storing the request.

### 1.6 Usage limits and technical data

- **AI usage counters:** to enforce daily AI usage limits, we store a daily
  count keyed to your user ID (if signed in), an anonymous random cookie
  identifier (if not signed in — see Section 6), or, as a fallback only, a
  **one-way hash of your IP address**. We do not store raw IP addresses in
  this system.
- **Analytics:** we use Vercel Analytics to collect aggregated page-view and
  usage statistics (see Section 4).
- **Server logs and AI service health:** our administrative monitoring records
  the operational status of our AI providers (success/failure/rate-limit
  events per provider). This monitoring is about provider health, not about
  the content of your requests.

---

## 2. How We Use Information

We use the information above to:

- Create and operate your account and authenticate you.
- Store and display your houses and profile.
- Operate classroom features: rosters, assignments, teacher read-only review,
  feedback, and grades.
- Provide AI features (question suggestions, critique, research with web
  citations, the context interview, and teacher-directed strawman
  generation).
- Enforce fair-use daily limits on AI features and prevent abuse.
- Understand aggregate usage of the Service (analytics) and keep it running.

We do not sell personal information, and we do not use your content or
personal information for advertising.

<!-- TODO: Confirm with counsel/vendors that none of the listed AI providers
use API traffic for model training under the account tiers actually in use,
before adding any "not used for training" claim. The code does not and cannot
guarantee vendor-side behavior. -->

---

## 3. AI Processing and Third-Party AI Providers

When you use an AI feature, the relevant content (your house content, your
question, and — for the interview — the conversation so far) is sent from our
servers to one or more third-party AI providers. Our routing system selects a
provider per request based on availability and request size. The providers
configured in the Service are:

- **Cerebras** (api.cerebras.ai)
- **Mistral AI** (api.mistral.ai)
- **Groq** (api.groq.com)
- **Google** (Gemini API, generativelanguage.googleapis.com)
- **OpenRouter** (openrouter.ai) — used only as a fallback of last resort

In addition, the **Research Mode** feature sends a search query (generated
from your house's question and content, not your identity) to **Brave Search**
(api.search.brave.com) to retrieve real web sources for citations.

AI requests are made server-side using our API keys; we do not send your
email address, user ID, or other account identifiers to these providers as
part of the request content. However, the content you write in a house or say
in the interview is, by necessity, shared with the provider that processes
that request, and their handling of API data is governed by their own terms
and privacy policies.

---

## 4. Other Third Parties (Subprocessors)

- **Supabase** — authentication, database, and storage of all account,
  profile, house, and classroom data described above.
- **Vercel** — application hosting and Vercel Analytics. Analytics collects
  page views and related technical signals; Vercel Analytics is designed to
  work without third-party cookies or persistent client-side identifiers.
- The AI providers and Brave Search listed in Section 3.

<!-- TODO: Confirm the full hosting/deployment picture (Vercel region, Supabase
project region) and add data-location statements if required for your
jurisdiction. -->

We do not use advertising networks or social media trackers.

---

## 5. Data Retention and Deletion

**We retain your account data, profile, houses, and classroom records for as
long as your account exists.** The Service does not currently implement
automatic retention periods or scheduled deletion of any stored data.

What the current system does and does not do:

- **AI interview transcripts** are not stored (only the distilled summary you
  approve into your house is saved).
- **Deleting a house** (where the interface allows it) removes the house and
  all of its layers from the database.
- **Deleting an assignment or class** does not delete student work: student
  houses are preserved and merely unlinked.
- **Account deletion is not yet self-serve.** The "Delete account" control in
  the profile page's Danger Zone does not currently delete anything; it
  informs you that deletion is not yet available. To delete your account,
  contact us (Section 10) and we will delete it manually. Our database is
  structured so that deleting an account cascades to delete its profile,
  houses and their contents, and class memberships.
- **AI usage counters** are stored per calendar day; the code does not
  currently purge old daily rows.

<!-- TODO: Decide on and document actual retention periods (especially for
student data — many school agreements require deletion within a set period
after the school year or on district request), and implement the deletion
paths this section promises manually. -->

---

## 6. Cookies and Local Storage

- **Authentication cookies** (Supabase): first-party cookies that keep you
  signed in. Strictly necessary for the Service to function.
- **`hot_aid`** — an anonymous, random, first-party, `httpOnly` cookie set
  when a signed-out visitor uses an AI feature. It exists solely to enforce
  the anonymous daily AI usage limit. It is not readable by page scripts, is
  not used for analytics or advertising, and is not linked to your identity;
  if you later sign in, we stop using it and rate-limit by your account
  instead. It expires after approximately 13 months.
- **Local storage:** if you use the builder without an account, your house
  content is kept in your browser's local storage on your device under a
  single key. It stays on your device unless you use an AI feature (Section
  1.3) and can be cleared through your browser settings.

We do not use third-party advertising or cross-site tracking cookies.

---

## 7. Children's Privacy (COPPA) and Student Records (FERPA)

The Service includes classroom features designed for use by students, and we
have written this section from what the product actually does today.

**How students get accounts.** Students create their **own** accounts with an
email address and password, selecting the "Student" account type themselves.
Teachers do **not** create accounts on students' behalf; they only share a
class join code that a student redeems after signing up. The Service does
**not** ask for a date of birth, does not verify age, and has **no built-in
parental-consent flow**.

**COPPA.** Because there is no age gate or parental/school consent mechanism
in the product, the Service is **not currently designed to accept
self-registered users under 13**. Children under 13 may not create accounts.
Where a school wishes to use the Service with students under 13, COPPA
permits a school to consent on parents' behalf for educational services, but
that consent must be established between us and the school **outside the
product** (e.g., in a written agreement), because the product itself has no
mechanism to record it.
<!-- TODO: Decide the actual policy: either (a) contractually restrict use to
13+, or (b) put school-consent agreements in place before any under-13 use, and
consider adding an age gate at signup. Counsel review required. -->

**What student data exists.** For a student account, the personal information
involved is: email address, chosen username and any optional profile fields
the student fills in, class memberships, houses (including assignment
submissions and any personal context the student shares with the AI
interview, of which only a distilled summary is stored), and teacher feedback
and grades on their submissions.

**FERPA.** Where the Service is used by a school, student submissions,
teacher feedback, and grades may constitute part of a student's education
records. In that setting we act as a provider to the school: teachers — not
we — control class creation, assignments, visibility, and grading, and we use
student data only to provide the Service (we do not sell it or use it for
advertising, per Section 2). Access controls in the product enforce that only
the student and their class's teacher(s) can see the student's work, and
students cannot see one another's rosters or houses.
<!-- TODO: FERPA compliance for school deployments typically requires a written
agreement with the school/district designating the provider as a "school
official" with legitimate educational interest, plus the deletion commitments
flagged in Section 5. Prepare a standard DPA/student-data agreement. -->

**A note on AI processing of student content** (Section 3): student house
content and interview messages are processed by the third-party AI providers
listed above. Schools evaluating the Service should review that list.

---

## 8. Your Rights and Choices

- **Access and correction:** you can view and edit your profile fields and
  your houses directly in the Service at any time.
- **Deletion:** house-level deletion is available in the product where shown;
  **account deletion currently requires contacting us** (see Sections 5 and
  10).
- **Leaving a class:** a student can remove themselves from a class, which
  ends the teacher's roster visibility going forward.
  <!-- TODO: Verify in-product UI for leaving a class exists (the database
  policy permits self-removal; confirm the interface exposes it). -->
- **Anonymous use:** you can use the core builder without an account; see
  Sections 1.3 and 6 for what that does and does not send to us.
- Depending on where you live, you may have additional legal rights (such as
  access, portability, deletion, or objection) under laws like the GDPR or
  state privacy laws. To exercise any right, contact us at the address in
  Section 10.
  <!-- TODO: Counsel to determine which regimes apply (GDPR/UK GDPR, CCPA/CPRA,
  state student-privacy laws such as SOPIPA) and expand this section
  accordingly. -->

---

## 9. Security

Data is stored in Supabase with row-level security policies enforcing the
access rules described in this policy (owner-only access to houses, read-only
teacher visibility, roster privacy between students). AI provider API keys
are held server-side only. Passwords are managed by Supabase Auth. No method
of transmission or storage is completely secure, and we cannot guarantee
absolute security.

---

## 10. Contact

Questions, requests (including account deletion), or complaints:

<!-- TODO: Contact email -->
- **Email:** [CONTACT EMAIL]
<!-- TODO: Registered/postal address -->
- **Address:** [REGISTERED ADDRESS]
<!-- TODO: Determine whether a Data Protection Officer or EU/UK representative
is required; if so, add their contact details here. -->

---

## 11. Changes to This Policy

We may update this policy from time to time. We will post the updated version
here with a new effective date. For material changes affecting classroom or
student data, we will make reasonable efforts to notify account holders (and,
for school deployments, the school).

<!-- TODO: Governing jurisdiction / relationship to the Terms of Service. -->
