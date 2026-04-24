# Memory: index.md
Updated: just now

# Project Memory

## Core
- **Framework:** Trapasso's 'Houses of Thought' vertical reasoning hierarchy.
- **AI Behavior:** Follow 'Zero-Explanation' rule. Never assume user preferences. Ground facts in Brave Search.
- **Data Integrity:** Require MLA 9 citations. Map hyphenated AI keys to snake_case.
- **Tech Stack:** Lovable Cloud Supabase, RLS (`user_id`), Edge Functions (masked errors).
- **AI Routing:** Groq (llama-3.3-70b-versatile) primary, Gemini 2.5 Flash fallback. Robust JSON parsing.
- **Security:** 30m inactivity timeout. reCAPTCHA & honeypots for signup. Admin uses service_role.
- **Account Types:** Three types (standard/student/teacher) on `profiles.account_type`. ALL gating goes through `src/lib/permissions.ts` + `usePermissions` hook — never hardcode account-type checks.
- **Workspace Partitioning:** Each account type is an independent workspace. `analyses`, `classrooms`, `classroom_members` carry `owner_account_type` and RLS filters by `current_account_type()`. Public analyses and teacher-view-of-submission cross types intentionally.

## Memories
- [Account type partitioning](mem://features/account-type-partitioning) — Per-workspace data isolation via owner_account_type + current_account_type() RLS helper
- [Account types & permissions](mem://features/account-types-permissions) — Centralized permissions module, Student locks AI sidebar & gets dedicated Research panel
- [Classrooms Phase 2](mem://features/classrooms-phase2) — Teacher classrooms + student join-by-code, RPC-gated membership
- [Classrooms Phase 3](mem://features/classrooms-phase3) — Assignments (empty/prefilled/template), submit flow, teacher read-only via membership-gated RLS
- [Classrooms Phase 4 — Comments](mem://features/classrooms-phase4-comments) — Three comment surfaces, audience modes, RPC-gated mutations, realtime + unread badges
- [Trapasso framework](mem://architecture/trapasso-framework) — Core reasoning framework definitions & structure
- [Schema definitions](mem://architecture/houses-of-thought-schema) — Required vs optional fields and To-Do prioritization
- [Visual hierarchy](mem://style/visual-hierarchy) — Vertical house metaphor and layer definitions
- [Color coding](mem://style/color-coding) — Color mapping for POVs and Assumptions
- [Attribution branding](mem://style/attribution-branding) — Branding and creator attribution rules
- [Analysis workflow](mem://features/analysis-workflow) — 7-step functional analysis workflow
- [Navigation breadcrumbs](mem://constraints/navigation-breadcrumbs) — Breadcrumb requirements for logical navigation
- [Dashboard management](mem://ui/dashboard-management) — Centralized project creation, global New House button forbidden
- [Dynamic back button](mem://features/dynamic-back-button) — Context-aware back navigation routing
- [Global nav consistency](mem://ui/global-navigation-consistency) — Footer and navigation visibility rules
- [Admin timezone](mem://ui/admin-timezone) — Admin panel PST timezone enforcement
- [Registration onboarding](mem://auth/registration-onboarding) — CTAs route directly to signup mode
- [Supabase stack](mem://tech/supabase-stack) — Primary database and edge function architecture
- [Hosting platform](mem://tech/hosting-platform) — Lovable Cloud Supabase integration details
- [Security RLS](mem://auth/security-rls) — Row Level Security policies and user isolation
- [Edge function security](mem://tech/edge-function-security) — Error masking, limits, and request constraints
- [Password policy](mem://auth/password-policy) — Password strength and HIBP breach checking
- [Session timeout](mem://auth/session-timeout) — 30-minute inactivity auto-logout rule
- [Bot protection](mem://tech/bot-protection) — Honeypots and reCAPTCHA implementation
- [AI configuration](mem://tech/ai-configuration) — Groq model specs, limits, and fallback logic
- [AI model assignment](mem://tech/ai-model-assignment) — Dynamic multi-provider routing architecture
- [AI routing logic](mem://tech/ai-routing-logic) — Priority scoring, failover, and JSON repair layer
- [AI parsing robustness](mem://tech/ai-parsing-robustness) — Regex JSON isolation and syntax repair utilities
- [Draft rate limits](mem://tech/draft-rate-limit-mitigation) — 3-second delays between sequential edge functions
- [Reasoning tool optimization](mem://tech/reasoning-tool-optimization) — Context summarization and token limits
- [AI context pruning](mem://tech/ai-context-pruning) — Middle-out truncation for chat history
- [AI field normalization](mem://tech/ai-field-normalization) — Hyphenated to snake_case mapping & sanitization
- [AI context behavior](mem://features/ai-context-behavior) — Sidebar context awareness and Zero-Explanation rule
- [AI action mode](mem://features/ai-action-mode) — Proposed Change cards for direct DB updates
- [AI auto-implementation](mem://features/ai-auto-implementation) — Toggle for automatic application of AI suggestions
- [AI sidebar actions](mem://features/ai-sidebar-text-actions) — Contextual text actions and Placement Selector
- [AI auto-drafting](mem://features/ai-auto-drafting) — Draft Full House iterative auto-refinement loop
- [AI large-scale generation](mem://features/ai-large-scale-generation) — Recursive batching and stream-to-database
- [AI draft content rules](mem://features/ai-draft-content-rules) — Formatting constraints and persona rules for drafts
- [AI multi-thread chat](mem://features/ai-multi-thread-chat) — Persistent context-seeded conversations
- [User profile context](mem://features/user-profile-context) — Persistent user data injected into AI prompts
- [Logic strength meter](mem://features/logic-strength-meter) — 0-100 evaluation scoring and metrics
- [Reasoning stress test](mem://features/reasoning-stress-test) — AI Attack Mode and counter-argument generation
- [Consequences vs implications](mem://features/consequences-ai-generation) — Distinction between Consequences and Implications
- [Evidence rating system](mem://features/evidence-rating-system) — Evidence strength ratings and sourcing requirements
- [Citation standards](mem://features/citation-standards) — Strict MLA 9 citation formatting rules
- [Brave search integration](mem://tech/brave-search-integration) — Edge function for web grounding
- [AI research mode](mem://features/ai-research-mode) — Rigorous source evaluation via Brave Search
- [Visual house builder](mem://features/visual-house-builder) — Drag-and-drop workspace and foundation warnings
- [Builder view persistence](mem://features/builder-view-persistence) — URL parameter preservation for builder mode
- [Guided Build Mode](mem://features/guided-build-mode) — Third view mode (Compass icon, above Standard/Interactive); 10-step onboarding flow with weighted progress, live-syncs to existing tables, auto-enters once per device
- [Custom POV nesting](mem://features/custom-pov-nesting) — Nested category labels for Point of View columns
- [Sharing visibility](mem://features/sharing-visibility) — Public read-only access and visibility rules
- [Owner privileges](mem://auth/owner-privileges) — Hardcoded OWNER secrets for Admin Panel access
- [Admin oversight](mem://features/admin-oversight) — Invisible admin monitoring of user analyses and chats
- [Admin service role](mem://tech/admin-service-role) — Service role bypass for administrative review
- [Visitor tracking](mem://tech/visitor-tracking) — Anonymous site visit tracking via local storage
- [Signup requirements](mem://auth/signup-requirements) — Age limits, TOS acceptance, and reCAPTCHA checks
