# ModelLock — Complete Product Vision, Architecture, and Cursor Build Specification

> **Canonical project constitution**
>
> This file is the authoritative specification for ModelLock. It defines the product thesis, user problem, scope, architecture, data model, operating constraints, security posture, automation, distribution, monetization, implementation process, and acceptance criteria.
>
> Cursor, Grok, other coding agents, and human contributors must consult this document before making architectural or product decisions. If generated code, documentation, or behavior conflicts with this file, the implementation is wrong unless this file is deliberately amended first.

---

## 0. Document Control

| Field | Value |
|---|---|
| Product | ModelLock |
| Working package name | `model-lock` |
| Primary artifact | `llm.lock.json` |
| Configuration file | `.llm-lock.yml` |
| Primary delivery surfaces | Local CLI, GitHub Action, public npm package |
| Initial language | TypeScript |
| Runtime | Current supported Node.js LTS |
| Initial repository model | One public GitHub repository |
| Creator-owned production backend | None |
| Creator-owned production database | None |
| Runtime AI dependency | None |
| Initial cash requirement | $0 beyond existing Cursor credits |
| Current preferred Cursor model | Grok 4.5 as of July 20, 2026 |
| Product stage | Specification / pre-MVP |
| License recommendation | Apache-2.0 for core; commercial license for optional paid modules |
| Copyright holder | Rabbott LLC (North Carolina, USA) |
| Operational publisher | Semi-anonymous GitHub/npm account (not a personal legal name) |
| Revision rule | Change this document before changing the product vision |

---

# 1. Executive Summary

ModelLock is a **lockfile and policy gate for AI model dependencies**.

Modern AI applications depend on model identifiers and provider facts that can change outside the application repository. A codebase can continue referencing the same apparent model name while the provider changes the underlying model version, price, context window, output limit, supported capabilities, lifecycle status, or retirement date.

Traditional software dependency systems solve a similar problem for packages:

- `package-lock.json`
- `poetry.lock`
- `Cargo.lock`
- `go.sum`

AI model dependencies usually have no equivalent approved state.

ModelLock introduces that missing layer.

A developer runs:

```bash
npx model-lock init
```

ModelLock scans the repository, identifies AI model dependencies, resolves current model metadata, and writes a deterministic `llm.lock.json` file. CI then compares the repository-approved state against current provider information.

When a material fact changes, ModelLock:

1. Identifies the affected dependency.
2. Shows the exact changed fields.
3. Shows the evidence and confidence behind the change.
4. Applies repository-defined policy.
5. Warns or blocks deployment.
6. Requires an explicit reviewed lockfile update before the new state is accepted.

The product's strategic value is not a chatbot, model recommendation engine, or dashboard. Its value is becoming the **canonical machine-readable record of what AI dependencies a software project has approved**.

The product should be:

- Useful without an account.
- Useful without a hosted dashboard.
- Useful without sending source code to a third party.
- Deterministic at runtime.
- Free to operate at initial scale.
- Automatically distributed through npm and GitHub Marketplace.
- Automatically updated through public CI.
- Monetizable later through standardized self-service features.
- Designed to require no routine human operation.

---

# 2. Foundational Thesis

## 2.1 Original thesis

> You control information; therefore, you control the decisions made by people and systems that depend on that information.

The ethical and durable commercial form of this thesis is:

> Control the trusted standard through which fragmented information becomes actionable, and you gain leverage over the workflow that depends on that standard.

ModelLock applies this thesis to AI software infrastructure.

AI applications depend on external provider information. That information is fragmented, mutable, inconsistent, and often not represented in version control.

ModelLock turns that information into:

- A normalized registry.
- A repository-specific approved snapshot.
- A policy decision.
- A deployment gate.
- An audit trail.

The control loop is:

```text
Provider facts
    ↓
Normalized evidence-backed registry
    ↓
Repository-specific approved lockfile
    ↓
Deterministic policy evaluation
    ↓
Deployment allowed, warned, or blocked
```

The defensible position is not “we know every model fact first.” The defensible position is:

> “Projects and organizations use our schema and tooling to decide whether model dependency changes are acceptable.”

## 2.2 Ethical boundary

ModelLock must not create leverage by hiding information, fabricating urgency, coercing customers, or making migration artificially difficult.

It should create leverage by:

- Making public or authorized information usable.
- Preserving provenance.
- Exposing uncertainty.
- Preventing silent changes.
- Improving customer autonomy.
- Supporting exportable open formats.
- Allowing customers to leave without losing their lockfiles.

The product should exploit **information fragmentation**, not exploit users.

---

# 3. Why This Product Exists

## 3.1 The problem

An AI-powered repository may contain:

```ts
const model = "grok-4.5";
```

or:

```python
model = os.getenv("LLM_MODEL", "some-provider-latest")
```

That string alone does not answer:

- Is this identifier fixed or floating?
- Which exact underlying version did the team approve?
- What did it cost when approved?
- What is its current price?
- What was its context window?
- What is its current context window?
- Did it support tool calls?
- Did it support structured output?
- Is it still active?
- Is it scheduled for retirement?
- Did the provider change parameter behavior?
- What evidence supports each fact?
- How confident is the system?
- Which changes should block deployment?

These facts currently live in a mixture of:

- Provider documentation.
- Pricing pages.
- Retirement notices.
- API references.
- Blog announcements.
- Model catalogs.
- SDK code.
- Environment variables.
- Developer memory.
- Internal spreadsheets.
- Support messages.
- GitHub issues.

This makes AI model dependencies operationally weaker than conventional package dependencies.

## 3.2 The cost of silent drift

Silent drift can produce:

- Unexpected cost increases.
- Context truncation.
- Broken structured output.
- Tool-call failures.
- Changed latency.
- Changed safety or refusal behavior.
- Removed modalities.
- Broken parameters.
- Sudden deprecation.
- Emergency migrations.
- Non-reproducible evaluations.
- Compliance and audit gaps.
- Production behavior that no reviewed code change introduced.

ModelLock does not promise to detect every behavioral difference. It addresses the subset that can be represented as evidence-backed dependency facts.

## 3.3 Why now

As of July 20, 2026:

- Grok 4.5 is documented by xAI as its frontier model for coding, agentic tasks, and knowledge work.
- Cursor documents Grok 4.5 as an available model for long-running coding and knowledge work.
- xAI distinguishes model names and aliases, including `-latest`-style aliases.
- GitHub Actions remains free for public repositories using standard GitHub-hosted runners.
- npm supports publishing public packages to the public registry.

These conditions make it possible to use a frontier coding model to build a deterministic product whose runtime requires no paid AI calls and whose public automation can run at no creator-owned infrastructure cost.

See the official references in [Appendix A](#appendix-a-official-reference-notes).

---

# 4. Product Definition

## 4.1 One-line description

> **Stop silent AI-model dependency drift before it reaches production.**

## 4.2 Category

ModelLock is an:

- AI dependency lockfile.
- Model metadata verifier.
- CI policy engine.
- Model lifecycle guard.
- Evidence-backed dependency audit tool.

It is not primarily:

- A model catalog.
- A pricing comparison site.
- A model benchmark service.
- A prompt evaluation platform.
- An observability dashboard.
- An AI gateway.
- An inference proxy.
- A secret-management platform.
- A hosted SaaS dashboard.
- An autonomous migration agent.

## 4.3 Core jobs to be done

### Job 1: Inventory

> Show me which AI models this repository depends on.

### Job 2: Snapshot

> Record the state of those dependencies that the team approved.

### Job 3: Detect

> Tell me when a material external fact changes.

### Job 4: Decide

> Apply our policy consistently to decide whether the change is acceptable.

### Job 5: Explain

> Show the evidence, confidence, and exact reason for the result.

### Job 6: Review

> Generate a proposed lockfile update that can be reviewed like any other dependency change.

### Job 7: Audit

> Preserve when and why the project accepted each model state.

---

# 5. Target Users

## 5.1 Primary initial user

An individual developer or small engineering team that:

- Maintains an AI-enabled repository.
- Uses one or more hosted model providers.
- Stores model identifiers in source or configuration.
- Uses GitHub Actions or local CI.
- Wants warning before material model changes affect production.
- Does not want to send source code to a third-party SaaS.

## 5.2 Secondary users

- Open-source AI projects.
- AI consultants maintaining client repositories.
- Platform engineering teams.
- Security teams.
- FinOps teams.
- Compliance teams.
- Internal developer-platform teams.
- Model gateway maintainers.
- AI SDK maintainers.
- Enterprise architecture teams.

## 5.3 Initial non-users

Do not optimize the MVP for:

- Nontechnical consumers.
- Teams requiring a graphical dashboard.
- Organizations requiring custom support contracts.
- Teams that use only self-hosted, immutable model artifacts.
- Users seeking “which model is best?” recommendations.
- Users seeking live quality benchmarking.
- Users seeking prompt optimization.

---

# 6. Product Principles

Every product decision must satisfy these principles.

## 6.1 Determinism before intelligence

Runtime decisions must be made by ordinary code, schemas, comparison logic, and policies.

No production LLM call is required.

## 6.2 Evidence before assertion

Every blocking fact must have:

- A source.
- A retrieval timestamp.
- A parser version.
- A digest.
- A confidence classification.

## 6.3 Uncertainty must remain visible

Unknown, stale, conflicting, and unavailable data must never be converted into fabricated certainty.

## 6.4 Failure must be conservative

An upstream outage must not falsely block deployment.

The system should preserve last-known-good data and emit a warning unless the customer explicitly configures stricter behavior.

## 6.5 Approval must be explicit

ModelLock may propose changes. It must never silently approve changes by rewriting a lockfile without an explicit command or reviewed pull request.

## 6.6 Source code stays local

The free product must not upload repository contents, snippets, secrets, or dependency-discovery results to creator-owned infrastructure.

## 6.7 Open artifact, optional paid tooling

The lockfile must remain readable and useful without a subscription.

Paid features may improve workflow but must not hold the customer's dependency record hostage.

## 6.8 No unnecessary surface area

Do not add a dashboard, account system, backend, database, or AI chat interface merely because an agent can build one.

## 6.9 Customer-pays computation where possible

Private-repository checks run in the customer's CI environment and use the customer's included compute allocation.

## 6.10 Automatic acquisition, not magical acquisition

The product must include distribution loops, but the plan must never assume that publishing alone guarantees users.

---

# 7. User Experience

## 7.1 First installation

The user sees the package in npm, GitHub Marketplace, a badge, a generated change page, or another repository.

They run:

```bash
npx model-lock init
```

The command:

1. Explains what it will scan.
2. Confirms that source code remains local.
3. Scans supported files.
4. Lists detected dependencies with confidence and source locations.
5. Creates `.llm-lock.yml`.
6. Creates `llm.lock.json`.
7. Optionally creates an example GitHub workflow.
8. Prints next steps.

Example:

```text
ModelLock found 3 AI model dependencies.

✓ xai / grok-4.5
  src/agents/research.ts:21
  discovery confidence: high
  version policy: floating alias

✓ anthropic / claude-example
  src/services/summarize.py:44
  discovery confidence: high
  version policy: fixed

? openai / ${OPENAI_MODEL}
  .env.example:12
  discovery confidence: explicit-variable
  resolution: configured fallback required

Created:
  .llm-lock.yml
  llm.lock.json
  .github/workflows/model-lock.yml

No repository contents were uploaded.
```

## 7.2 Normal pull request

On every pull request:

```bash
npx model-lock check
```

Possible result:

```text
MODELLOCK PASSED

3 dependencies checked
0 blocking changes
1 warning

WARN xai/grok-4.5 uses a floating alias.
Approved registry snapshot: 2026-07-20
Current registry snapshot: 2026-07-20
```

## 7.3 Scheduled drift detection

A weekly scheduled workflow runs even when repository code has not changed.

If provider facts changed:

```text
MODELLOCK POLICY FAILURE

Dependency:
  xai/grok-4.5

Repository location:
  src/agents/research.ts:21

Material changes:
  FAIL output price increased from 6.00 to 7.50 USD per million tokens
  FAIL context limit decreased from 500,000 to 256,000 tokens
  WARN model identifier is a floating alias

Evidence:
  official-provider-documentation
  fetched: 2026-08-03T06:17:00Z
  confidence: official-verified

Deployment blocked by:
  maximumOutputPriceIncreasePercent
  failOnContextDecrease

Next commands:
  npx model-lock explain xai:grok-4.5
  npx model-lock update --report
```

## 7.4 Reviewing an update

The user runs:

```bash
npx model-lock update --report
```

ModelLock writes:

```text
.model-lock/proposed/llm.lock.json
.model-lock/reports/2026-08-03-model-change.md
```

It does not replace the approved lockfile.

The user can explicitly write:

```bash
npx model-lock update --write
```

or use an optional workflow that opens a pull request.

## 7.5 Explanation

```bash
npx model-lock explain xai:grok-4.5
```

Output includes:

- Requested identifier.
- Resolved version policy.
- Approved values.
- Current values.
- Field-level differences.
- Policy rule.
- Evidence sources.
- Confidence.
- Source freshness.
- Parser version.
- Whether the fact can block CI.

---

# 8. Core CLI Contract

The CLI executable is:

```bash
model-lock
```

The npm invocation is:

```bash
npx model-lock
```

## 8.1 `model-lock init`

### Purpose

Create the initial configuration and lockfile.

### Required behavior

- Scan supported file types.
- Exclude dependency, build, generated, and secret-heavy directories.
- Detect model dependencies.
- Show file and line number.
- Assign discovery confidence.
- Resolve metadata.
- Write deterministic configuration and lockfile files.
- Never modify application source files.
- Never upload source content.
- Refuse to overwrite existing files without an explicit flag.
- Support noninteractive mode.

### Suggested flags

```text
--config <path>
--lockfile <path>
--provider <provider>
--model <model>
--workflow
--no-workflow
--non-interactive
--force
--json
--offline
```

## 8.2 `model-lock scan`

Although not required in the earliest prototype, this should become a first-class command.

### Purpose

Inventory dependencies without creating or modifying files.

### Suggested flags

```text
--format text|json|sarif
--include <glob>
--exclude <glob>
--minimum-confidence <level>
```

## 8.3 `model-lock check`

### Purpose

Compare the approved lockfile with the current normalized registry and apply policy.

### Required behavior

- Validate configuration.
- Validate lockfile.
- Load current registry.
- Compare field by field.
- Apply policy.
- Produce stable exit codes.
- Support human-readable, JSON, and SARIF output.
- Produce GitHub annotations when running in GitHub Actions.
- Never treat unknown data as a changed known value.
- Never block using low-confidence data unless explicitly configured.

### Suggested flags

```text
--config <path>
--lockfile <path>
--registry <path-or-url>
--format text|json|sarif
--offline
--strict
--fail-on-warning
--report <path>
```

## 8.4 `model-lock update`

### Purpose

Generate a proposed new approved state.

### Required behavior

- Calculate the candidate lockfile.
- Generate a change report.
- Preserve deterministic key ordering.
- Preserve comments only in configuration, not JSON.
- Require `--write` to replace the approved lockfile.
- Support output to a proposed path.
- Refuse if current data is invalid or below required confidence.
- Include old and new evidence.

### Suggested flags

```text
--write
--report
--output <path>
--model <provider:model>
--accept <field>
--offline
```

The MVP does not need field-by-field partial approval, but the schema should not prevent it later.

## 8.5 `model-lock explain <provider:model>`

### Purpose

Explain one dependency's state and decision.

### Required behavior

- Show approved state.
- Show current state.
- Show all differences.
- Show relevant policy.
- Show evidence.
- Show confidence.
- Show source freshness.
- Show whether a result is blocking.
- Show remediation commands.

## 8.6 `model-lock validate`

### Purpose

Validate configuration, lockfile, and optional local registry files.

This command is valuable for editors and CI.

## 8.7 `model-lock registry`

Future command group, not required for MVP.

Possible subcommands:

```text
model-lock registry status
model-lock registry update
model-lock registry verify
```

---

# 9. File Contracts

## 9.1 `.llm-lock.yml`

This file expresses user intent and policy.

Example:

```yaml
version: 1

discovery:
  enabled: true
  languages:
    - javascript
    - typescript
    - python
  include:
    - "src/**/*"
    - ".env.example"
  exclude:
    - "node_modules/**"
    - "dist/**"
    - "build/**"
    - ".venv/**"
    - "vendor/**"
    - "**/*.min.js"
  minimumConfidence: medium

models:
  - provider: xai
    id: grok-4.5
    locations:
      - src/agents/research.ts:21

policy:
  floatingAliases: warn
  retirementWindowDays: 90
  maximumInputPriceIncreasePercent: 15
  maximumOutputPriceIncreasePercent: 15
  failOnContextDecrease: true
  failOnMaximumOutputDecrease: true
  failOnToolCallingRemoval: true
  failOnStructuredOutputRemoval: true
  failOnVisionRemoval: false

sources:
  staleAfterDays: 7
  onSourceFailure: use-last-known-good
  minimumConfidenceForBlocking: official-verified

output:
  format: text
  writeReport: true
```

## 9.2 `llm.lock.json`

This is the repository-approved dependency state.

### Required properties

- Lockfile schema version.
- Generation timestamp.
- Generator version.
- Registry snapshot identity.
- Configuration digest.
- Dependency list.
- Requested identifier.
- Canonical provider.
- Canonical model identifier.
- Version policy.
- Lifecycle information.
- Pricing information.
- Limits.
- Capabilities.
- Evidence.
- Confidence.
- Discovery locations.
- Field-level unknown support.
- Deterministic ordering.

Example:

```json
{
  "lockfileVersion": 1,
  "generatedAt": "2026-07-20T16:00:00Z",
  "generator": {
    "name": "model-lock",
    "version": "0.1.0"
  },
  "registry": {
    "snapshot": "2026-07-20",
    "digest": "sha256:example"
  },
  "configurationDigest": "sha256:example",
  "models": [
    {
      "provider": "xai",
      "requestedId": "grok-4.5",
      "canonicalId": "grok-4.5",
      "versionPolicy": "floating-alias",
      "discovery": {
        "confidence": "high",
        "locations": [
          {
            "path": "src/agents/research.ts",
            "line": 21,
            "column": 17,
            "kind": "sdk-call"
          }
        ]
      },
      "lifecycle": {
        "status": "active",
        "retirementDate": null
      },
      "pricing": {
        "currency": "USD",
        "inputPerMillionTokens": 2,
        "outputPerMillionTokens": 6
      },
      "limits": {
        "contextTokens": 500000,
        "maximumOutputTokens": null
      },
      "capabilities": {
        "toolCalling": true,
        "structuredOutput": true,
        "vision": true
      },
      "evidence": [
        {
          "factPath": "pricing.outputPerMillionTokens",
          "sourceType": "official-provider-documentation",
          "sourceUrl": "https://docs.x.ai/",
          "checkedAt": "2026-07-20T15:55:00Z",
          "contentDigest": "sha256:example",
          "parserVersion": "xai-docs-v1",
          "confidence": "official-verified"
        }
      ]
    }
  ]
}
```

The example values are illustrative. The application must never hard-code them as timeless truth.

## 9.3 Registry snapshot

The public registry should be stored in the same public repository or a dedicated public registry repository.

Suggested paths:

```text
registry/latest.json
registry/snapshots/2026-07-20.json
registry/snapshots/2026-07-21.json
registry/changelog/2026-07-21.md
registry/schemas/registry-v1.schema.json
```

A snapshot is append-only after publication except for clearly documented security or integrity corrections.

## 9.4 Report files

Suggested path:

```text
.model-lock/reports/
```

Reports should be safe to commit but ignored by default unless the user chooses otherwise.

---

# 10. Normalized Data Model

## 10.1 Provider

```ts
type ProviderId =
  | "xai"
  | "openai"
  | "anthropic"
  | "google";
```

The schema must allow future provider IDs without requiring a lockfile-version change.

## 10.2 Version policy

```ts
type VersionPolicy =
  | "fixed-version"
  | "floating-alias"
  | "provider-default"
  | "environment-resolved"
  | "unknown";
```

## 10.3 Lifecycle status

```ts
type LifecycleStatus =
  | "preview"
  | "active"
  | "deprecated"
  | "retiring"
  | "retired"
  | "unavailable"
  | "unknown";
```

## 10.4 Evidence confidence

Required confidence taxonomy:

```ts
type EvidenceConfidence =
  | "official-verified"
  | "multi-source-verified"
  | "single-source"
  | "conflicting"
  | "stale"
  | "unavailable";
```

## 10.5 Discovery confidence

Discovery confidence is separate from evidence confidence.

```ts
type DiscoveryConfidence =
  | "explicit"
  | "high"
  | "medium"
  | "low";
```

Examples:

- `explicit`: configured directly in `.llm-lock.yml`.
- `high`: AST-recognized provider SDK argument.
- `medium`: model-like environment fallback linked to provider usage.
- `low`: untyped string match.

Low-confidence discoveries must not be added automatically without clear marking or user approval.

## 10.6 Fact wrapper

Every normalized fact should be representable as:

```ts
interface Fact<T> {
  value: T | null;
  state: "known" | "unknown" | "not-applicable";
  evidence: EvidenceReference[];
  confidence: EvidenceConfidence;
  effectiveAt?: string;
  expiresAt?: string;
}
```

This avoids collapsing unknown into false, zero, or null without semantic meaning.

## 10.7 Pricing

```ts
interface PricingFacts {
  currency: Fact<string>;
  inputPerMillionTokens: Fact<number>;
  cachedInputPerMillionTokens?: Fact<number>;
  outputPerMillionTokens: Fact<number>;
  reasoningPerMillionTokens?: Fact<number>;
  imageInputUnitPrice?: Fact<number>;
}
```

The MVP policy engine only needs input and output token prices. The schema should tolerate additional provider-specific price dimensions.

## 10.8 Limits

```ts
interface LimitFacts {
  contextTokens: Fact<number>;
  maximumOutputTokens: Fact<number>;
}
```

## 10.9 Capabilities

```ts
interface CapabilityFacts {
  toolCalling: Fact<boolean>;
  structuredOutput: Fact<boolean>;
  vision: Fact<boolean>;
}
```

Future capabilities may include audio, video, web search, code execution, batch API, caching, log probabilities, fine-tuning, and regional availability. Do not add them to MVP policy unless required.

## 10.10 Model identity

```ts
interface ModelIdentity {
  provider: string;
  requestedId: string;
  canonicalId: string | null;
  aliases: string[];
  versionPolicy: VersionPolicy;
}
```

## 10.11 Evidence record

```ts
interface EvidenceReference {
  factPath: string;
  sourceId: string;
  sourceType:
    | "official-provider-documentation"
    | "official-provider-api"
    | "official-provider-announcement"
    | "structured-community-registry"
    | "deprecation-feed"
    | "manual-override";
  sourceUrl: string;
  checkedAt: string;
  contentDigest: string;
  parserVersion: string;
  confidence: EvidenceConfidence;
  excerpt?: string;
}
```

Excerpt storage must be short, optional, and legally conservative.

---

# 11. Source Architecture

## 11.1 Source classes

The initial registry can use three source classes.

### Class A: Structured model catalog

Use a structured public source such as `models.dev` for:

- Provider identifiers.
- Model identifiers.
- Pricing.
- Limits.
- Capabilities.

Treat community-maintained data as an input, not unquestionable authority.

### Class B: Deprecation and retirement feeds

Use structured lifecycle sources such as `deprecations.info` when available.

### Class C: Official provider evidence

Use official documentation or official machine-readable endpoints to verify facts capable of blocking deployment.

## 11.2 Adapter interface

Every adapter must implement a common interface.

```ts
interface SourceAdapter {
  id: string;
  parserVersion: string;
  fetch(context: FetchContext): Promise<RawSourceResult>;
  validate(raw: RawSourceResult): ValidatedSourceResult;
  normalize(validated: ValidatedSourceResult): NormalizedFactSet;
}
```

## 11.3 Fetch requirements

Every network request must have:

- HTTPS.
- Allowlisted hostname.
- Fixed method.
- Timeout.
- Maximum response size.
- Redirect limit.
- Content-type validation.
- User-agent.
- Retry limit with jitter.
- Cache-aware headers when appropriate.
- No credentials for public sources.
- Safe error classification.

## 11.4 Source failure behavior

Source failures include:

- Timeout.
- DNS failure.
- HTTP error.
- Schema mismatch.
- Malformed JSON.
- Oversized response.
- Unexpected content type.
- Redirect to unapproved host.
- Parser failure.
- Empty data.
- Suspicious content change.

Default behavior:

```text
source fails
    ↓
do not publish a new trusted fact from that source
    ↓
retain last-known-good fact
    ↓
mark freshness/confidence appropriately
    ↓
warn
    ↓
open a diagnostic issue in registry repository
```

## 11.5 Source conflict behavior

When sources disagree:

1. Do not choose a value merely because it is newer.
2. Prefer official evidence where unambiguous.
3. Preserve all competing values.
4. Mark the fact `conflicting`.
5. Freeze the last-known-good approved value.
6. Emit a warning.
7. Do not create a new blocking fact unless explicitly configured.

## 11.6 Freshness

Each source and fact should support:

- `checkedAt`
- `effectiveAt`
- `staleAfter`
- `expiresAt`

Staleness is not the same as falsity.

A stale fact should remain available but should not silently be represented as freshly verified.

## 11.7 Content digests

Store a SHA-256 digest over the canonicalized relevant source payload or extracted evidence region.

The digest supports:

- Change detection.
- Auditing.
- Parser debugging.
- Reproducibility.
- Detection of silent page changes.

Do not store whole copyrighted webpages unless legally justified.

---

# 12. Dependency Discovery

## 12.1 Supported file types

MVP:

- `.ts`
- `.tsx`
- `.js`
- `.jsx`
- `.mjs`
- `.cjs`
- `.py`
- `.json`
- `.yaml`
- `.yml`
- `.env.example`
- explicitly configured text files

## 12.2 Excluded paths

Default exclusions:

```text
node_modules/**
dist/**
build/**
coverage/**
vendor/**
.venv/**
venv/**
__pycache__/**
.git/**
.next/**
.nuxt/**
target/**
out/**
**/*.min.js
**/*.map
**/generated/**
```

## 12.3 Discovery methods

Use, in order of reliability:

1. Explicit configuration.
2. AST-recognized SDK calls.
3. Provider client construction linked to model arguments.
4. Typed configuration structures.
5. Environment-variable fallbacks.
6. JSON or YAML provider configuration.
7. Conservative string matching.

## 12.4 JavaScript and TypeScript examples

Recognize patterns such as:

```ts
client.responses.create({ model: "..." })
client.chat.completions.create({ model: "..." })
anthropic.messages.create({ model: "..." })
generateText({ model: provider("...") })
```

Do not assume every `model` property is an LLM dependency.

The parser must use contextual provider signals.

## 12.5 Python examples

Recognize patterns such as:

```python
client.responses.create(model="...")
client.chat.completions.create(model="...")
anthropic.messages.create(model="...")
genai.GenerativeModel("...")
```

## 12.6 Environment variables

Example:

```env
OPENAI_MODEL=gpt-example
```

Discovery should associate the variable with a provider only when:

- The variable name is provider-specific, or
- Code links it to a known provider client.

Dynamic values must be represented honestly:

```text
requestedId: ${OPENAI_MODEL}
versionPolicy: environment-resolved
```

The configuration may specify an approved resolved value per environment.

## 12.7 Discovery result

```ts
interface DiscoveredDependency {
  provider: string | null;
  requestedId: string;
  confidence: DiscoveryConfidence;
  locations: SourceLocation[];
  kind:
    | "sdk-call"
    | "config"
    | "environment"
    | "explicit"
    | "string-match";
}
```

## 12.8 False-positive control

Required safeguards:

- No raw grep-only auto-locking.
- No scanning binaries.
- No scanning dependency directories.
- No treating arbitrary model names in documentation as production dependencies by default.
- No treating tests as production dependencies unless configured.
- Show uncertain matches.
- Allow ignore directives.
- Allow path-specific overrides.
- Include fixtures from real repository patterns.

---

# 13. Difference Engine

## 13.1 Design goals

The diff engine must be:

- Deterministic.
- Field-level.
- Order-stable.
- Pure where possible.
- Independently testable.
- Unaware of output formatting.
- Capable of representing unknown-to-known and known-to-unknown transitions.

## 13.2 Change categories

```ts
type ChangeKind =
  | "added"
  | "removed"
  | "increased"
  | "decreased"
  | "changed"
  | "became-known"
  | "became-unknown"
  | "became-conflicting"
  | "confidence-changed"
  | "evidence-changed";
```

## 13.3 Material versus informational changes

Examples of material changes:

- Active to retiring.
- Retirement date enters configured window.
- Price increase exceeds threshold.
- Context limit decreases.
- Maximum output decreases.
- Tool calling changes true to false.
- Structured output changes true to false.
- Vision changes true to false.
- Fixed identifier becomes unresolved.
- Provider removes model.

Examples of informational changes:

- Additional alias.
- Evidence URL changes but value remains identical.
- Confidence improves.
- Price decreases.
- Context increases.
- New non-policy capability.
- Parser version changes without fact change.

Policy decides whether a material change warns or fails.

## 13.4 Unknown semantics

These must be distinct:

```text
true → false
true → unknown
unknown → false
```

Only `true → false` is verified capability removal.

`true → unknown` means verification was lost and should normally warn, not claim removal.

---

# 14. Policy Engine

## 14.1 Policy configuration

MVP rules:

```yaml
policy:
  floatingAliases: warn
  retirementWindowDays: 90
  maximumInputPriceIncreasePercent: 15
  maximumOutputPriceIncreasePercent: 15
  failOnContextDecrease: true
  failOnMaximumOutputDecrease: true
  failOnToolCallingRemoval: true
  failOnStructuredOutputRemoval: true
  failOnVisionRemoval: false
```

## 14.2 Source-confidence policy

```yaml
sources:
  staleAfterDays: 7
  onSourceFailure: use-last-known-good
  minimumConfidenceForBlocking: official-verified
```

Allow values:

```text
official-verified
multi-source-verified
single-source
```

`conflicting`, `stale`, and `unavailable` are states rather than minimums.

## 14.3 Decision levels

```ts
type DecisionLevel =
  | "pass"
  | "info"
  | "warn"
  | "fail";
```

## 14.4 Rule output

```ts
interface PolicyDecision {
  ruleId: string;
  level: DecisionLevel;
  modelKey: string;
  factPath?: string;
  message: string;
  approvedValue?: unknown;
  currentValue?: unknown;
  evidenceConfidence?: EvidenceConfidence;
  remediation?: string[];
}
```

## 14.5 Default confidence matrix

| Evidence state | May inform | May warn | May fail |
|---|---:|---:|---:|
| Official verified | Yes | Yes | Yes |
| Multi-source verified | Yes | Yes | Yes |
| Single source | Yes | Yes | No |
| Conflicting | Yes | Yes | No |
| Stale | Yes | Yes | No |
| Unavailable | Yes | Yes | No |

Users may choose stricter behavior, but safe defaults matter.

## 14.6 Stable exit codes

Recommended exit codes:

| Code | Meaning |
|---:|---|
| 0 | Passed |
| 1 | Policy failure |
| 2 | Invalid configuration |
| 3 | Invalid lockfile |
| 4 | Registry unavailable with no usable fallback |
| 5 | Internal error |
| 6 | Unsupported lockfile version |
| 7 | Discovery ambiguity requiring input |

Exit codes become a public contract and require tests.

---

# 15. Output Formats

## 15.1 Text

Optimized for terminal readability.

## 15.2 JSON

Machine-readable full result.

Suggested schema:

```ts
interface CheckReport {
  reportVersion: 1;
  generatedAt: string;
  result: "pass" | "warn" | "fail";
  dependenciesChecked: number;
  decisions: PolicyDecision[];
  registry: RegistryReference;
}
```

## 15.3 SARIF

Use SARIF for:

- GitHub code scanning.
- File and line annotations.
- Machine-readable findings.
- Security and compliance integration.

SARIF messages must not claim security vulnerabilities unless the rule actually represents one.

## 15.4 GitHub step summary

The Action should write a concise summary with:

- Overall result.
- Counts.
- Affected models.
- Blocking rules.
- Commands.
- Link to generated report artifact.

---

# 16. GitHub Action

## 16.1 Action type

Use a bundled JavaScript Action for portability and predictable startup.

`action.yml` at repository root.

## 16.2 Default permissions

Documentation and example workflows must default to:

```yaml
permissions:
  contents: read
```

## 16.3 Optional update workflow

Opening issues or pull requests requires a separate opt-in workflow:

```yaml
permissions:
  contents: write
  pull-requests: write
  issues: write
```

Do not request these permissions in the basic check workflow.

## 16.4 Inputs

Suggested inputs:

```text
config
lockfile
registry
format
fail-on-warning
offline
github-token
```

`github-token` should only be necessary for optional write operations.

## 16.5 Outputs

Suggested outputs:

```text
result
failure-count
warning-count
report-path
registry-snapshot
```

## 16.6 Events

Example check workflow:

```yaml
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: "17 6 * * 1"
```

Use a non-round minute to reduce scheduler congestion.

## 16.7 Annotations

Annotate:

- Source file and line where dependency is declared.
- Configuration rule where appropriate.
- Lockfile dependency object where source location is unavailable.

## 16.8 Fork safety

Pull requests from forks must not receive write secrets.

Basic checking must require no secret.

Optional pull-request creation must run only in a trusted event context.

## 16.9 Action release pinning

Documentation should recommend pinning to:

1. A full commit SHA for maximum security.
2. A major tag for convenience.

The repository should maintain:

```text
v1
v1.2
v1.2.3
```

through release automation.

---

# 17. Zero-Cash Architecture

## 17.1 Development

Use:

- Cursor.
- Grok 4.5 or the latest stable strong coding model available in Cursor.
- Local Node.js.
- Local Git.
- Public GitHub repository.

No separate AI API is required.

## 17.2 Runtime

The CLI executes locally or on the customer's CI runner.

No creator-owned server processes requests.

## 17.3 Storage

Use:

- Git repository history.
- Versioned JSON.
- GitHub release artifacts where appropriate.
- npm registry package versions.

No database is required.

## 17.4 Scheduled updates

Use GitHub Actions in the public registry repository.

Official GitHub documentation states that Actions usage is free for public repositories using standard GitHub-hosted runners.

## 17.5 Package distribution

Publish the public package to npm.

npm documentation supports publishing public packages to the public registry.

## 17.6 Documentation hosting

Use:

- GitHub README.
- GitHub Pages.
- Generated static Markdown/HTML.

No paid hosting is required.

## 17.7 Error reporting

Automated source failures can open GitHub issues in the public repository.

Do not send customer repository errors to a central service by default.

## 17.8 Runtime AI prohibition

The production product must not require:

- Grok API.
- OpenAI API.
- Anthropic API.
- Google model API.
- Any inference API.

AI is used to build the deterministic tool, not to operate it.

---

# 18. Repository Structure

Recommended single-repository structure:

```text
model-lock/
├── .github/
│   ├── ISSUE_TEMPLATE/
│   │   ├── bug.yml
│   │   ├── source-breakage.yml
│   │   └── feature.yml
│   ├── workflows/
│   │   ├── ci.yml
│   │   ├── integration.yml
│   │   ├── refresh-registry.yml
│   │   ├── release.yml
│   │   ├── publish-npm.yml
│   │   ├── publish-action.yml
│   │   ├── docs.yml
│   │   └── scorecard.yml
│   ├── dependabot.yml
│   └── CODEOWNERS
├── docs/
│   ├── index.md
│   ├── installation.md
│   ├── configuration.md
│   ├── lockfile-specification.md
│   ├── source-confidence.md
│   ├── security.md
│   ├── privacy.md
│   ├── troubleshooting.md
│   ├── release-process.md
│   └── architecture.md
├── registry/
│   ├── latest.json
│   ├── metadata.json
│   ├── snapshots/
│   ├── changelog/
│   └── schemas/
├── schemas/
│   ├── configuration-v1.schema.json
│   ├── lockfile-v1.schema.json
│   ├── registry-v1.schema.json
│   ├── report-v1.schema.json
│   └── source-result-v1.schema.json
├── src/
│   ├── cli.ts
│   ├── action.ts
│   ├── commands/
│   │   ├── init.ts
│   │   ├── scan.ts
│   │   ├── check.ts
│   │   ├── update.ts
│   │   ├── explain.ts
│   │   └── validate.ts
│   ├── config/
│   │   ├── load.ts
│   │   ├── defaults.ts
│   │   ├── schema.ts
│   │   └── digest.ts
│   ├── discovery/
│   │   ├── index.ts
│   │   ├── filesystem.ts
│   │   ├── javascript.ts
│   │   ├── typescript.ts
│   │   ├── python.ts
│   │   ├── json.ts
│   │   ├── yaml.ts
│   │   ├── env.ts
│   │   ├── providers.ts
│   │   └── ignore.ts
│   ├── sources/
│   │   ├── adapter.ts
│   │   ├── fetch.ts
│   │   ├── models-dev.ts
│   │   ├── deprecations-info.ts
│   │   ├── official/
│   │   │   ├── xai.ts
│   │   │   ├── openai.ts
│   │   │   ├── anthropic.ts
│   │   │   └── google.ts
│   │   └── classify.ts
│   ├── normalize/
│   │   ├── model.ts
│   │   ├── provider.ts
│   │   ├── pricing.ts
│   │   ├── lifecycle.ts
│   │   ├── limits.ts
│   │   ├── capabilities.ts
│   │   └── evidence.ts
│   ├── registry/
│   │   ├── build.ts
│   │   ├── read.ts
│   │   ├── write.ts
│   │   ├── verify.ts
│   │   ├── snapshot.ts
│   │   └── last-known-good.ts
│   ├── lockfile/
│   │   ├── read.ts
│   │   ├── write.ts
│   │   ├── canonicalize.ts
│   │   ├── migrate.ts
│   │   └── validate.ts
│   ├── diff/
│   │   ├── compare.ts
│   │   ├── changes.ts
│   │   └── values.ts
│   ├── policy/
│   │   ├── evaluate.ts
│   │   ├── rules/
│   │   │   ├── floating-alias.ts
│   │   │   ├── retirement.ts
│   │   │   ├── pricing.ts
│   │   │   ├── limits.ts
│   │   │   └── capabilities.ts
│   │   └── confidence.ts
│   ├── reports/
│   │   ├── text.ts
│   │   ├── json.ts
│   │   ├── sarif.ts
│   │   ├── markdown.ts
│   │   └── github-summary.ts
│   ├── security/
│   │   ├── sanitize.ts
│   │   ├── urls.ts
│   │   ├── limits.ts
│   │   └── secrets.ts
│   └── util/
│       ├── errors.ts
│       ├── exit-codes.ts
│       ├── hashing.ts
│       ├── time.ts
│       ├── sorting.ts
│       └── result.ts
├── tests/
│   ├── unit/
│   ├── integration/
│   ├── contract/
│   ├── property/
│   └── security/
├── fixtures/
│   ├── repositories/
│   ├── sources/
│   ├── lockfiles/
│   ├── configurations/
│   └── malicious/
├── action.yml
├── package.json
├── package-lock.json
├── tsconfig.json
├── tsconfig.build.json
├── vitest.config.ts
├── eslint.config.js
├── LICENSE
├── SECURITY.md
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
├── CHANGELOG.md
├── README.md
└── MODELLOCK-PLAN.md
```

Use `MODELLOCK-PLAN.md` as this document's repository filename.

---

# 19. Security Model

## 19.1 Threat model

Potential threats include:

- Malicious upstream source content.
- Compromised structured registry.
- Dependency supply-chain compromise.
- Pull-request code execution.
- Secret exposure in logs.
- Path traversal.
- Symlink traversal.
- Oversized files.
- Resource exhaustion.
- Prototype pollution.
- Command injection.
- Unsafe URL redirects.
- Malicious model names.
- SARIF or Markdown injection.
- Compromised npm token.
- Compromised GitHub Action release.
- Dependency confusion.
- Untrusted lockfile content.
- False blocking caused by bad data.

## 19.2 Trust boundaries

Trust levels:

1. Application's own compiled code.
2. Repository configuration and lockfile.
3. Public ModelLock registry snapshot.
4. Official provider sources.
5. Community-maintained sources.
6. Arbitrary repository source files.
7. Pull-request content.
8. Network responses.

All external data is untrusted until validated.

## 19.3 Principle of least privilege

Basic checking needs:

```yaml
permissions:
  contents: read
```

No write access.

## 19.4 Network allowlist

Registry refresh jobs should use an explicit hostname allowlist.

The customer CLI should, by default, fetch only:

- The configured ModelLock registry URL.
- Explicitly configured sources when direct mode is enabled.

## 19.5 Secret handling

- Do not print environment-variable values.
- Do not scan `.env` by default.
- Scan `.env.example` only.
- Redact query strings from URLs in errors.
- Never upload source snippets.
- Avoid dumping raw external responses into CI logs.
- Provide `--debug` with explicit warnings.
- Keep debug output sanitized.

## 19.6 File-system safety

- Resolve paths against repository root.
- Reject traversal outside root.
- Do not follow symlinks outside root.
- Limit file size.
- Limit file count.
- Skip binary files.
- Avoid executing repository code during discovery.

## 19.7 Parser safety

- AST parse only; never import or execute customer files.
- YAML parsing must use safe schema.
- JSON parsing must reject prototypes where applicable.
- Regexes must avoid catastrophic backtracking.
- HTML extraction must sanitize output.

## 19.8 Supply-chain safety

- Commit lockfile.
- Use npm provenance.
- Enable dependency review.
- Enable code scanning.
- Use Dependabot.
- Pin GitHub Actions to commit SHAs in the project's own workflows.
- Generate SBOM on release.
- Sign or attest release artifacts where practical.
- Publish checksums.
- Protect release branches and tags.
- Require CI before release.

## 19.9 Registry integrity

Each snapshot should include:

- Schema version.
- Generation time.
- Generator version.
- Source list.
- Snapshot digest.
- Previous snapshot digest.
- Optional signature or provenance attestation.

A hash chain makes historical tampering easier to detect.

## 19.10 Failure safety

A malformed or unavailable source must not generate false facts.

A compromised community source must not independently produce a default blocking result.

---

# 20. Privacy Model

## 20.1 Default privacy promise

> ModelLock scans source code locally. It does not send repository contents to ModelLock-owned infrastructure.

## 20.2 Telemetry

MVP should contain no telemetry.

Do not collect:

- Repository name.
- File paths.
- Model usage.
- Organization name.
- CI result.
- Source code.
- Environment variables.
- IP-linked analytics from CLI execution.

GitHub and npm may expose aggregate public installation or download information under their own systems. Document this distinction.

## 20.3 Optional future telemetry

Do not add telemetry without:

- Explicit opt-in.
- Published event schema.
- No source-code contents.
- Easy disablement.
- Privacy documentation.
- A clear product need.

---

# 21. Registry Automation

## 21.1 Scheduled workflow

The public registry workflow runs on a conservative schedule, initially daily or several times weekly.

Daily is sufficient for MVP.

## 21.2 Pipeline

```text
1. Checkout repository.
2. Install pinned dependencies.
3. Fetch each source with strict limits.
4. Validate raw responses.
5. Normalize facts.
6. Compare source agreement.
7. Classify confidence.
8. Compare against last-known-good snapshot.
9. Run invariants.
10. Run unit, contract, regression, and security tests.
11. Generate candidate snapshot.
12. Generate candidate changelog.
13. Publish only if all gates pass.
14. Preserve previous snapshot if any gate fails.
15. Open or update one diagnostic GitHub issue per source/parser failure.
```

## 21.3 Publication rules

Publish a new snapshot when:

- At least one normalized fact changed, or
- Evidence was refreshed according to policy, or
- A new source or model was added.

Do not publish meaningless timestamp-only churn unless freshness is part of the snapshot contract.

## 21.4 Invariants

Required invariants:

1. No model loses a known field merely because a source failed.
2. No price becomes negative.
3. No token limit becomes negative or non-integer.
4. No retirement date predates an announcement without evidence.
5. No provider ID changes without alias/migration handling.
6. No official-verified fact is generated without official evidence.
7. No conflicting fact is classified as verified.
8. No unknown field is silently coerced to false or zero.
9. Snapshot output is deterministic.
10. Rebuilding from identical inputs yields identical content except deliberately excluded build metadata.
11. Every published snapshot validates against schema.
12. Every source URL passes allowlist and HTTPS requirements.

## 21.5 Diagnostic issues

Automatically opened issue should include:

- Adapter.
- Parser version.
- Failure class.
- First failing timestamp.
- Last successful timestamp.
- Sanitized error.
- Response digest if available.
- Relevant fixture path.
- Reproduction command.
- Whether last-known-good remains valid.

Do not include raw sensitive content.

## 21.6 Issue deduplication

Use a deterministic issue key:

```text
source-id + parser-version + failure-class
```

Update an existing open issue instead of opening daily duplicates.

Close automatically after a successful verified refresh.

---

# 22. Testing Strategy

## 22.1 Test layers

### Unit tests

Pure functions:

- Canonicalization.
- Hashing.
- Difference calculation.
- Policy evaluation.
- Confidence rules.
- Sorting.
- Exit codes.
- Output formatting.

### Fixture tests

Static provider responses and repository examples.

### Contract tests

Validate adapters against recorded source contracts.

### Integration tests

Run CLI against fixture repositories.

### Property-based tests

Useful for:

- Lockfile canonicalization.
- Diff symmetry or expected asymmetry.
- Percentage thresholds.
- Unknown-value transitions.
- Parser robustness.
- Deterministic output.

### Security tests

- Path traversal.
- Symlink escape.
- Oversized response.
- Malicious JSON.
- YAML alias attacks.
- Prototype pollution.
- Terminal escape injection.
- Markdown injection.
- SARIF injection.
- Regex denial of service.
- Redirect to untrusted host.
- Secret-like text in logs.

### Live scheduled tests

May fetch public sources but must not run in ordinary pull-request CI.

## 22.2 Required source fixtures

- Valid official response.
- Valid community response.
- Missing fields.
- Null fields.
- Wrong types.
- Malformed JSON.
- HTML instead of JSON.
- Oversized response.
- Timeout.
- Redirect loop.
- Unapproved redirect.
- Duplicate model IDs.
- Conflicting price.
- Conflicting retirement date.
- Changed page structure.
- Empty provider list.
- Malicious strings.
- Unicode model IDs.
- Very large numeric values.

## 22.3 Required repository fixtures

- TypeScript OpenAI-style SDK.
- JavaScript xAI-style SDK.
- Python Anthropic-style SDK.
- Google SDK.
- Environment variable.
- Dynamic model selector.
- Multiple providers.
- Monorepo.
- Test-only dependency.
- Documentation mentioning model names.
- Generated source.
- Minified source.
- False-positive `model` property.
- No dependencies.
- Invalid syntax.
- Symlink.
- Huge file.

## 22.4 Required policy fixtures

- Floating alias warn.
- Floating alias fail.
- Price increase below threshold.
- Price increase at threshold.
- Price increase above threshold.
- Price decrease.
- Context decrease.
- Context increase.
- Output-limit decrease.
- Capability true-to-false.
- Capability true-to-unknown.
- Lifecycle active-to-retiring.
- Retirement inside window.
- Retirement outside window.
- Single-source fact.
- Conflicting fact.
- Stale fact.
- Unavailable registry with fallback.
- Unavailable registry without fallback.

## 22.5 Coverage

Do not optimize blindly for 100% coverage.

Required:

- High branch coverage for policy and diff engines.
- Complete tests for stable exit codes.
- Complete tests for schema migrations.
- Complete tests for failure fallback.
- Complete tests for security-sensitive path and URL logic.

---

# 23. Performance Requirements

MVP targets on a typical developer machine:

| Operation | Target |
|---|---:|
| Validate existing lockfile | < 250 ms |
| Check using cached registry | < 1 s |
| Scan 1,000 source files | < 5 s |
| Generate report | < 500 ms |
| Maximum default scanned file size | 2 MB |
| Maximum default repository files scanned | Configurable, safe default |
| Network timeout per source | 10 s or less |
| Maximum source response | Source-specific, hard capped |

Do not sacrifice correctness for premature optimization.

Use concurrency with bounds.

---

# 24. Accessibility and Developer Experience

Even though the product is CLI-first:

- Do not rely on color alone.
- Respect `NO_COLOR`.
- Support plain text.
- Keep errors actionable.
- Use stable terminology.
- Include commands in failures.
- Make JSON output complete.
- Keep terminal width adaptable.
- Avoid animated spinners in CI.
- Show progress only in interactive mode.
- Support Windows, macOS, and Linux.

---

# 25. Documentation Requirements

## 25.1 README opening

The README must begin:

> **Stop silent AI-model dependency drift before it reaches production.**

Then show:

1. Problem.
2. 30-second example.
3. Installation.
4. Generated lockfile.
5. Failure output.
6. Privacy promise.
7. Supported providers.
8. Supported file types.
9. Link to full docs.

## 25.2 Installation guide

Cover:

- npm local use.
- npx use.
- GitHub Action.
- Pinning Action version.
- Windows shells.
- Offline mode.
- Uninstallation.

## 25.3 Configuration reference

Every field needs:

- Type.
- Default.
- Example.
- Allowed values.
- Security implications.
- Whether changing it updates lockfile digest.

## 25.4 Lockfile specification

Document:

- Schema.
- Canonical ordering.
- Meaning of null and unknown.
- Versioning.
- Migration.
- Evidence.
- Confidence.
- Compatibility guarantees.

## 25.5 Source-confidence model

Explain why:

- Official is not automatically error-free.
- Community sources are inputs.
- Conflicts warn.
- Outages freeze last-known-good.
- Low confidence does not block by default.

## 25.6 Security documentation

Include:

- Threat model.
- Permissions.
- Network behavior.
- Source-code privacy.
- Vulnerability reporting.
- Supported versions.
- Release integrity.

## 25.7 Troubleshooting

Include:

- False positive.
- Model not detected.
- Dynamic environment model.
- Registry unavailable.
- Source stale.
- Conflicting data.
- Invalid lockfile.
- Unsupported schema version.
- GitHub permission failure.
- SARIF upload issue.

## 25.8 Contribution guide

Contributors adding a provider must supply:

- Adapter.
- Schema.
- Fixtures.
- Contract tests.
- Failure fixtures.
- Documentation.
- Source provenance.
- Security review checklist.

---

# 26. Distribution System

The product must not depend on outbound sales or recurring creator marketing.

That does not mean distribution is optional. Distribution must be embedded in use.

## 26.1 npm discovery

Publish with accurate keywords:

```json
{
  "keywords": [
    "llm",
    "ai",
    "lockfile",
    "model",
    "dependency",
    "deprecation",
    "pricing",
    "github-action",
    "ci",
    "grok",
    "openai",
    "anthropic",
    "gemini"
  ]
}
```

Avoid keyword spam.

## 26.2 GitHub Marketplace

Publish the Action with categories aligned to:

- Continuous integration.
- Code quality.
- Security where justified.

The listing should focus on exact jobs:

- Detect AI model drift.
- Warn about retirement.
- Guard token price changes.
- Preserve approved capabilities.

## 26.3 Badge loop

Offer a badge:

```markdown
[![ModelLock: AI dependencies verified](BADGE_URL)](PROJECT_URL)
```

MVP badge can be static or generated from public workflow status.

Do not create a centralized badge service that introduces cost.

## 26.4 Generated reference pages

The registry can generate static pages:

```text
/models/xai/grok-4-5
/models/retiring-within-90-days
/changes/2026-08-03
/providers/xai
/capabilities/structured-output
```

These pages derive from registry data and require no manual articles.

## 26.5 Failure-message loop

Every useful failure output names ModelLock and provides a documentation path.

Do not turn errors into advertisements. The product identity should be clear but restrained.

## 26.6 Template integrations

Provide ready-to-copy workflows for:

- Node.
- Python.
- Monorepo.
- Scheduled-only monitoring.
- Pull-request gating.
- SARIF upload.

## 26.7 Open-source ecosystem

Potential automated or low-maintenance routes:

- Starter templates.
- Dev container feature.
- GitHub Action.
- npm package.
- Renovate-compatible lockfile support later.
- Pre-commit hook later.
- VS Code schema association.
- Dependabot-like update pull request workflow.

## 26.8 Honest acquisition assumption

The project may still receive no users.

Validation must measure:

- Installs retained.
- Scheduled checks retained.
- Issues opened by real users.
- Repositories committing lockfiles.
- Requests for advanced policy.

Do not confuse npm downloads caused by bots or CI with active adoption.

---

# 27. Monetization

## 27.1 Monetization principle

Do not monetize before the core utility has repeat use.

The free lockfile and basic checking should remain useful.

## 27.2 Potential editions

### Community

- Dependency discovery.
- Lockfile.
- Core policy checks.
- Public registry.
- Text and JSON report.
- Basic GitHub Action.

### Pro

Potential features:

- SARIF.
- Advanced policy rules.
- Multiple environments.
- Monorepo optimization.
- Custom registries.
- Signed attestations.
- Extended evidence reports.
- Local historical comparison.
- Automated update pull requests.
- Policy packs.

Illustrative price: `$49/year`.

### Team

Potential features:

- Organization policy bundle.
- Central configuration repository.
- Multiple repository templates.
- Custom provider adapters.
- Policy attestation.
- Aggregated local reporting without creator-hosted data.
- Commercial license.

Illustrative price: `$149/year`.

Prices are hypotheses, not validated facts.

## 27.3 No backend licensing option

A self-service license provider can issue keys after payment.

The CLI can validate a license through the provider's license API or use signed offline licenses.

Preferred eventual architecture:

```text
Hosted checkout
    ↓
automatic license issuance
    ↓
license key stored as customer CI secret
    ↓
CLI validates entitlement
```

A signed offline license is preferable if it can avoid a recurring availability dependency while preserving reasonable enforcement.

## 27.4 Billing constraints

Before paid launch:

- Complete seller identity verification.
- Understand taxes and platform fees.
- Publish refund terms.
- Avoid custom contracts.
- Avoid manual invoices.
- Avoid guaranteed response-time support.
- Avoid lifetime licenses unless economics are understood.

## 27.5 Product-led upgrade triggers

The product may show an upgrade notice only when the user invokes a paid feature.

Do not degrade core safety to force payment.

## 27.6 No-support fantasy

Even an automated product can create:

- Refund disputes.
- Security reports.
- License failures.
- Tax documents.
- Platform account issues.

Design for near-zero routine operation, not zero legal responsibility.

---

# 28. Scope

## 28.1 MVP providers

- xAI
- OpenAI
- Anthropic
- Google

Do not add more until the four-adapter system is stable.

## 28.2 MVP languages

- TypeScript.
- JavaScript.
- Python.
- JSON.
- YAML.
- `.env.example`.

## 28.3 MVP facts

- Provider.
- Requested model ID.
- Canonical model ID.
- Fixed versus floating policy.
- Lifecycle status.
- Retirement date.
- Input price.
- Output price.
- Context limit.
- Maximum output limit.
- Tool calling.
- Structured output.
- Vision.
- Evidence.
- Confidence.

## 28.4 Explicit exclusions

Do not add to MVP:

- Web dashboard.
- React app.
- User accounts.
- Hosted database.
- Hosted API required for use.
- Slack alerts.
- Email alerts.
- Webhooks.
- Prompt evaluation.
- Model benchmarking.
- “Best model” recommendations.
- Live inference testing.
- Automated code migration.
- Generated migration patches.
- Runtime AI.
- Provider contract interpretation.
- Privacy certification.
- Compliance certification.
- Full model cost estimation from customer traffic.
- Model gateway.
- Inference proxy.
- Secrets manager.
- Agent chat.
- IDE extension.
- Browser extension.
- Mobile application.

## 28.5 Scope-change rule

A feature may enter MVP only if it is required to complete one of:

- Inventory.
- Snapshot.
- Detect.
- Decide.
- Explain.
- Review.
- Audit.

Convenient but nonessential features wait.

---

# 29. Implementation Phases

Each phase ends with formatting, linting, type checking, tests, documentation updates, and a commit.

## Phase 0: Repository constitution

Deliver:

- This file at `MODELLOCK-PLAN.md`.
- README skeleton.
- License.
- Contribution rules.
- Toolchain.
- Node version.
- Package manager lockfile.
- CI skeleton.
- Architecture decision record directory.

Acceptance:

- Fresh clone installs.
- Formatting, lint, type check, and tests run.
- No production code yet.
- Cursor rules reference this document.

## Phase 1: Schemas and domain types

Deliver:

- Configuration schema.
- Lockfile schema.
- Registry schema.
- Report schema.
- Source-result schema.
- TypeScript inferred types.
- Canonical serialization.
- Version fields.

Acceptance:

- Valid fixtures pass.
- Invalid fixtures fail with exact paths.
- Unknown semantics are represented.
- Deterministic serialization test passes.

## Phase 2: Pure diff and policy engine

Deliver:

- Field-level difference engine.
- Policy rules.
- Confidence gating.
- Stable exit-code mapping.
- Text-neutral decision objects.

Acceptance:

- Full matrix of threshold and unknown tests.
- No network or file-system dependency.
- Same inputs produce identical decisions.

## Phase 3: Registry reader and last-known-good

Deliver:

- Read local registry.
- Read remote registry.
- Validate digest.
- Cache snapshot.
- Select last-known-good.
- Offline mode.

Acceptance:

- Upstream unavailable with cache warns and continues.
- Invalid current registry never replaces valid cache.
- No cache plus unavailable registry returns documented code.

## Phase 4: Source adapters

Deliver:

- Common adapter interface.
- Safe fetch layer.
- `models.dev` adapter.
- Deprecation source adapter.
- Initial official adapters for four providers.
- Confidence classification.

Acceptance:

- Every adapter has fixtures.
- Every adapter handles malformed and hostile input.
- Official verification is impossible without official evidence.
- Live tests run only on schedule/manual workflow.

## Phase 5: Registry builder

Deliver:

- Normalization.
- Conflict resolution.
- Candidate snapshot.
- Hash chain.
- Changelog generation.
- Invariants.

Acceptance:

- Identical inputs produce identical snapshot.
- Conflicts preserved.
- Failed source cannot erase good facts.
- Candidate fails publication if invariant fails.

## Phase 6: Repository discovery

Deliver:

- File walker.
- Ignore handling.
- JS/TS parser.
- Python parser.
- JSON/YAML parser.
- Environment example parser.
- Provider-context matching.
- Confidence scores.

Acceptance:

- Realistic fixture repositories.
- False-positive fixtures.
- No customer code execution.
- File and line locations.
- Safe behavior on malformed syntax.

## Phase 7: Lockfile generation

Deliver:

- `init`.
- Lockfile writer.
- Config generator.
- Existing-file safety.
- Proposed update path.
- Configuration digest.

Acceptance:

- Repeated generation is stable.
- No source files modified.
- Existing lockfile not overwritten accidentally.
- Low-confidence matches are visible.

## Phase 8: CLI completion

Deliver:

- `init`.
- `scan`.
- `check`.
- `update`.
- `explain`.
- `validate`.
- Text, JSON, SARIF.
- Stable errors and exit codes.

Acceptance:

- Windows/macOS/Linux tests where feasible.
- `NO_COLOR`.
- Noninteractive mode.
- Snapshot tests for output.
- End-to-end fixture tests.

## Phase 9: GitHub Action

Deliver:

- Bundled Action.
- Step summary.
- Annotations.
- Artifact report.
- Minimal permissions.
- Example workflows.
- Optional update PR workflow.

Acceptance:

- Works in public test repository.
- Basic path requires no secret.
- Fork PR cannot access write credentials.
- Action bundle is committed and reproducible.

## Phase 10: Automation

Deliver:

- CI.
- Scheduled source integration tests.
- Registry refresh.
- Diagnostic issue automation.
- Release workflow.
- npm provenance.
- GitHub release.
- Major tag movement.
- Docs deployment.
- SBOM/attestation where practical.

Acceptance:

- Dry-run release succeeds.
- Failed registry refresh preserves old snapshot.
- Issue deduplication works.
- Published artifacts match source commit.

## Phase 11: Documentation and launch readiness

Deliver:

- Complete documentation set.
- Marketplace metadata.
- npm metadata.
- Security policy.
- Privacy policy.
- Changelog.
- Example repositories.

Acceptance:

- A new user can install without private help.
- All example commands work.
- No unsupported claims.
- No paid dependency in free path.
- No runtime AI.

## Phase 12: Validation

Test against at least 20 unrelated public AI repositories.

Measure:

- Discovery precision.
- Discovery recall where manually knowable.
- Time to first lockfile.
- False CI failures.
- Source outage behavior.
- Retained installations.
- Scheduled usage.
- Requested features.

Do not add billing before validation thresholds are met.

---

# 30. Validation Criteria

## 30.1 Technical

1. Detect dependencies in at least 20 unrelated repositories.
2. Manually sampled precision at least 95%.
3. Seeded price changes detected.
4. Seeded lifecycle changes detected.
5. Seeded context reductions detected.
6. Seeded capability removals detected.
7. Upstream outage causes no false policy failure under default policy.
8. Lockfile generation is deterministic.
9. No source code leaves the machine.
10. Fresh installation works from npm.
11. GitHub Action works with read-only permission.
12. SARIF validates.

## 30.2 Product

1. At least 25 unrelated repositories retain the Action.
2. At least five run scheduled checks.
3. At least five commit `llm.lock.json`.
4. At least one user requests a higher-level organization or policy feature.
5. At least one real drift event is usefully identified.
6. Users understand the difference between discovery confidence and evidence confidence.

## 30.3 Kill conditions

Stop or reposition if:

- Users only want a retirement-date feed.
- Model metadata cannot be verified reliably enough.
- Provider-source changes require constant manual parser repair.
- False positives remain unacceptable.
- Users refuse to commit a lockfile.
- Existing tools fully absorb the lockfile-policy position.
- Distribution produces no retained installations.
- Customers require a dashboard before seeing value.

## 30.4 Pivot options

If the full model-fact scope is too unstable:

### Pivot A: Lifecycle-only lockfile

Focus on retirement, alias type, and availability.

### Pivot B: Cost-policy lockfile

Focus on pricing and context limits.

### Pivot C: Evidence schema

Become an open standard and library used by other tooling.

### Pivot D: Repository scanner

Focus on inventory plus retirement exposure.

A pivot must preserve the core thesis: approved external dependency facts in version control.

---

# 31. Cursor Operating Rules

Create `.cursor/rules/model-lock.mdc` or the current Cursor-equivalent rules file.

Required content:

```text
MODELLOCK PROJECT CONSTITUTION

Before planning or implementing any task, read MODELLOCK-PLAN.md.

MODELLOCK-PLAN.md is authoritative for:
- product vision
- scope
- architecture
- security
- data semantics
- implementation phases
- acceptance criteria

Do not add:
- runtime AI
- a hosted backend
- a database
- accounts
- a dashboard
- telemetry
- source-code upload
unless MODELLOCK-PLAN.md is deliberately amended first.

For every implementation task:
1. State which sections of MODELLOCK-PLAN.md govern the work.
2. Inspect current repository state.
3. Produce a narrow plan.
4. Implement the smallest complete change.
5. Add or update tests.
6. Run format, lint, type check, and tests.
7. Report exact commands and results.
8. Identify any deviation from the constitution.
9. Do not leave TODOs in released paths.
10. Do not claim success when tests fail.

Never execute customer source code during discovery.
Never convert unknown data into certainty.
Never let low-confidence data block by default.
Never silently replace llm.lock.json.
Never require a paid API for the free path.
```

## 31.1 Agent discipline

Cursor must not:

- Rewrite large areas without understanding tests.
- Add dependencies casually.
- suppress type errors.
- weaken tests to make code pass.
- use `any` as a shortcut.
- catch and ignore errors.
- log raw source responses.
- expose secrets.
- change public contracts without migration.
- add speculative abstractions before a use case.
- create UI unrelated to core jobs.
- publish packages automatically from untrusted pull requests.

## 31.2 Context management

At the beginning of a new Cursor session:

1. Read `MODELLOCK-PLAN.md`.
2. Read relevant ADRs.
3. Read `package.json`.
4. Read current phase checklist.
5. Run tests before changing code.
6. Summarize repository state.
7. Work only on one phase or bounded issue.

## 31.3 Required end-of-task report

Every Cursor task should conclude with:

```text
Implemented:
- ...

Constitution sections applied:
- ...

Files changed:
- ...

Commands run:
- ...

Results:
- ...

Security considerations:
- ...

Known limitations:
- ...

Deferred work:
- ...
```

---

# 32. Architecture Decision Records

Create `docs/adr/`.

Initial ADRs:

```text
0001-cli-and-github-action-first.md
0002-no-runtime-ai.md
0003-no-creator-owned-backend.md
0004-json-lockfile-yaml-config.md
0005-evidence-confidence-model.md
0006-last-known-good-source-failure.md
0007-typescript-node-runtime.md
0008-public-registry-in-git.md
0009-no-telemetry-by-default.md
0010-explicit-lockfile-approval.md
```

Each ADR includes:

- Status.
- Context.
- Decision.
- Consequences.
- Alternatives.
- Security implications.
- Conditions for reversal.

---

# 33. Release Strategy

## 33.1 Versioning

Use Semantic Versioning for CLI and Action.

Lockfile schema version is separate from package version.

## 33.2 Pre-1.0

```text
0.1.0 schemas and policy core
0.2.0 discovery and init
0.3.0 registry and sources
0.4.0 GitHub Action
0.5.0 public alpha
0.9.0 release candidate
1.0.0 stable public contract
```

Do not rush 1.0 before:

- Lockfile schema is stable.
- Exit codes are stable.
- Failure fallback is proven.
- Real repositories have tested it.
- Security review is complete.

## 33.3 Release checklist

- Clean working tree.
- Correct version.
- Changelog updated.
- Schemas versioned.
- Migration tests pass.
- Format passes.
- Lint passes.
- Type check passes.
- Unit tests pass.
- Integration tests pass.
- Security tests pass.
- Action bundle rebuilt.
- Bundle diff reviewed.
- SBOM generated.
- Provenance configured.
- npm dry run reviewed.
- Marketplace metadata valid.
- Release notes generated.
- Tags signed or protected.
- Major tag moved only after release succeeds.

## 33.4 Rollback

A bad release must be:

- Deprecated on npm where appropriate.
- Documented.
- Followed by a patch release.
- Not silently replaced, because npm versions are immutable.
- Reflected in GitHub Action tags.
- Accompanied by security notice if necessary.

---

# 34. Support Model

## 34.1 Self-service first

Use:

- Troubleshooting docs.
- Structured error codes.
- GitHub issue templates.
- Automated diagnostics.
- Reproduction bundles that exclude source code.
- Public discussions if useful.

## 34.2 No promised manual SLA

Do not promise:

- Immediate responses.
- Custom onboarding.
- Custom adapters.
- Emergency migrations.
- Legal or compliance advice.

## 34.3 Automated diagnostic bundle

Future command:

```bash
model-lock doctor
```

It may output:

- Tool version.
- Node version.
- OS.
- Config validation.
- Lockfile validation.
- Registry status.
- Cache status.
- Adapter health.
- Sanitized errors.

It must not include source code or secrets.

---

# 35. Risks and Mitigations

## 35.1 Provider documentation changes frequently

Mitigation:

- Prefer structured APIs.
- Adapter fixtures.
- Parser versioning.
- Last-known-good.
- Diagnostic issues.
- Community contributions.
- Restrict official parsing to necessary facts.

## 35.2 Public sources disagree

Mitigation:

- Preserve conflict.
- Confidence classification.
- Official evidence preference.
- No block from conflicts by default.

## 35.3 Model behavior changes without metadata change

Mitigation:

- State clearly that ModelLock tracks declared dependency facts, not all behavior.
- Do not overclaim reproducibility.
- Future behavioral fingerprints are separate research, not MVP.

## 35.4 False positive discovery

Mitigation:

- AST context.
- Confidence.
- Explicit review.
- Ignore rules.
- Real repository fixture corpus.

## 35.5 No one installs it

Mitigation:

- Tight one-command onboarding.
- Marketplace.
- npm.
- Badge.
- Generated reference pages.
- Validate quickly.
- Kill or pivot rather than endlessly build.

## 35.6 Existing competitor copies the lockfile

Mitigation:

- Open schema may be copied.
- Win through implementation quality, installed base, evidence history, integrations, and trust.
- A standard can be valuable even when open.

## 35.7 Zero-cash services change pricing

Mitigation:

- Keep architecture portable.
- Registry is plain files.
- CLI is local.
- GitHub Actions workflows can migrate.
- npm package can have alternate distribution.
- Avoid proprietary runtime coupling.

## 35.8 Licensing creates maintenance burden

Mitigation:

- Delay paid edition.
- Use standardized license provider.
- Keep paid feature set narrow.
- Consider commercial package rather than hosted service.

## 35.9 Legal claims

Mitigation:

- No guarantee provider data is error-free.
- Evidence and timestamps.
- Clear disclaimer.
- No legal/compliance certification.
- No automatic destructive action.
- Explicit customer review.

## 35.10 Autonomous maintenance is incomplete

Mitigation:

- Be honest.
- Automate routine updates.
- Preserve safe fallback.
- Create issues for exceptional breakage.
- Design adapters so one broken source does not collapse product.

---

# 36. Success Metrics

## 36.1 North-star metric

> Number of repositories with a committed `llm.lock.json` that run ModelLock checks repeatedly.

This is better than npm downloads.

## 36.2 Activation

A repository is activated when it:

1. Generates a lockfile.
2. Commits it.
3. Runs at least one check.

## 36.3 Retention

A repository is retained when it runs a check in a later 30-day window.

## 36.4 Value event

A value event occurs when ModelLock detects a real external change and produces a useful decision or reviewed update.

## 36.5 Quality metrics

- Discovery precision.
- False-block rate.
- Registry freshness.
- Adapter uptime.
- Last-known-good fallback success.
- Time to resolve source parser breakage.
- Determinism failures.
- Security issues.
- Uninstall reasons where voluntarily reported.

## 36.6 Monetization metric

Only after paid launch:

- Percentage of retained repositories attempting paid features.
- Self-service conversion.
- Refund rate.
- License validation failure rate.
- Support burden per paid account.

---

# 37. Initial Build Commands

Suggested setup, subject to current tool versions:

```bash
mkdir model-lock
cd model-lock
git init

npm init -y
npm install zod commander yaml
npm install -D typescript tsx vitest eslint prettier @types/node \
  fast-check @vercel/ncc

npx tsc --init
```

Cursor must verify current compatible package versions before installation.

Do not use version ranges carelessly in release infrastructure.

---

# 38. Master Cursor Build Prompt

Paste the following into Cursor Agent mode after placing this file in the repository.

```text
You are implementing ModelLock.

MODELLOCK-PLAN.md is the authoritative product constitution. Read it fully before
planning or editing code. If any instruction in this prompt conflicts with that
document, follow MODELLOCK-PLAN.md and report the conflict.

PRODUCT GOAL

ModelLock is package-lock.json for AI model dependencies.

It scans a repository for AI provider/model dependencies, generates an
llm.lock.json snapshot of the facts that repository approved, and warns or fails
CI when material external facts drift.

CORE FACTS

- provider
- requested model identifier
- canonical model identifier
- whether the identifier is floating or fixed
- lifecycle status
- retirement date
- input and output token pricing
- context limit
- maximum output limit
- tool-calling support
- structured-output support
- vision support
- evidence sources
- evidence timestamps
- evidence content digests
- parser versions
- discovery confidence
- evidence confidence

NON-NEGOTIABLE CONSTRAINTS

- No LLM or AI API calls at runtime.
- No creator-owned production database.
- No creator-owned required backend.
- No authentication system for the free path.
- No telemetry.
- No browser automation.
- No headless browser.
- No paid API dependency.
- No secrets required for the free path.
- Complete core product runs as a local CLI and GitHub Action.
- Use current supported Node LTS and pin it.
- Use strict TypeScript.
- Validate all external and internal structured data.
- Use Vitest.
- Use a minimal CLI framework.
- Bundle the GitHub Action into committed distribution output.
- Bound network time, redirects, and response sizes.
- Ordinary tests never depend on live external services.
- Scheduled integration tests may use live public sources.
- Never silently modify an approved lockfile.
- Upstream outage must not cause a false policy failure.
- Freeze last-known-good data on source failure.
- Conflicting facts do not block by default.
- Unknown facts are never invented.
- Customer source code never leaves the runner.
- Never execute customer source code during discovery.
- Do not print untrusted source content without sanitization.

IMPLEMENTATION PROCESS

1. Read MODELLOCK-PLAN.md.
2. Inspect repository state.
3. Identify the current implementation phase.
4. Produce a bounded implementation plan.
5. Implement one complete phase or subphase.
6. Add fixtures and tests.
7. Run formatting.
8. Run linting.
9. Run type checking.
10. Run tests.
11. Fix all failures.
12. Report files changed, commands, results, security implications, limitations,
    and deferred work.

Do not skip phases merely because later functionality is more visually
impressive.

COMMANDS

Implement:

- model-lock init
- model-lock scan
- model-lock check
- model-lock update
- model-lock explain <provider:model>
- model-lock validate

SOURCE ADAPTERS

Build a common adapter contract and adapters for:

- models.dev structured data
- a structured deprecation source
- official xAI evidence
- official OpenAI evidence
- official Anthropic evidence
- official Google evidence

Every adapter returns normalized source results and must have static fixtures.

CONFIDENCE

Evidence confidence:

- official-verified
- multi-source-verified
- single-source
- conflicting
- stale
- unavailable

Discovery confidence:

- explicit
- high
- medium
- low

Only official-verified and multi-source-verified facts may block by default.

LOCKFILE

Create a versioned JSON Schema for llm.lock.json.

The lockfile must be:

- deterministic
- human-readable
- stable under repeated generation
- forward-versioned
- validated before reading or writing
- free of secrets
- able to represent unknown and conflicting facts
- evidence-backed

POLICY ENGINE

Support:

- deny or warn on floating aliases
- retirement window in days
- maximum percentage input-price increase
- maximum percentage output-price increase
- fail on context decrease
- fail on maximum-output decrease
- fail on tool-calling removal
- fail on structured-output removal
- fail on vision removal
- stale-source behavior
- source-failure behavior
- minimum confidence required for blocking

DISCOVERY

Use AST parsing where practical.

The scanner must:

- exclude dependencies, environments, builds, generated and minified files
- report file and line
- distinguish provider model IDs from unrelated strings
- assign confidence
- never auto-approve low-confidence matches
- allow explicit configuration overrides
- never import or execute repository files

GITHUB ACTION

Create action.yml at repository root.

Default permissions:

contents: read

Provide a separate optional example for issue and pull-request creation with
narrow write permissions.

The Action must:

- run model-lock check
- support pull_request, push and schedule
- write a GitHub step summary
- annotate relevant source locations
- upload a machine-readable report
- never send repository contents to ModelLock infrastructure

AUTOMATION

Create workflows for:

- formatting, linting, type checking and tests
- scheduled source contract checks
- scheduled registry refresh
- release bundling
- npm publishing with provenance
- GitHub release creation
- Action tag management
- static documentation generation
- dependency review and security scanning where practical

REGISTRY REFRESH

The refresh workflow must:

1. Fetch sources.
2. Validate all responses.
3. Normalize facts.
4. Compare source agreement.
5. Classify confidence.
6. Run fixtures, invariants, and regression tests.
7. Generate a candidate snapshot.
8. Publish only if every gate passes.
9. Preserve the prior snapshot otherwise.
10. Open or update a deduplicated diagnostic issue on breakage.
11. Generate a Markdown changelog.
12. Maintain snapshot digest continuity.

TESTING

Include fixtures for:

- valid provider data
- missing fields
- malformed JSON
- wrong content type
- oversized responses
- timeouts
- redirects
- conflicting pricing
- conflicting retirement dates
- aliases
- renamed models
- capability removal
- capability becoming unknown
- context decrease
- price increase
- stale sources
- unavailable sources
- malicious strings
- deterministic lockfile regeneration
- false-positive repository model strings
- dynamic environment variables
- monorepos
- path traversal
- symlink escape
- terminal, Markdown and SARIF injection

DOCUMENTATION

Write:

- README.md
- installation guide
- configuration reference
- lockfile specification
- architecture
- security model
- source-confidence model
- GitHub Action examples
- CLI examples
- troubleshooting
- contribution guide
- privacy statement
- release process

README opening:

“Stop silent AI-model dependency drift before it reaches production.”

SCOPE CONTROL

Do not add:

- React
- dashboard
- database
- accounts
- billing during MVP
- email
- Slack
- webhooks
- benchmarks
- recommendations
- runtime model tests
- prompt evaluation
- generated migration code
- hosted inference
- runtime AI

COMPLETION REPORT

At the end of each task, provide:

- constitution sections applied
- implementation summary
- final file tree for affected area
- exact commands run
- exact test results
- security review notes
- known limitations
- deferred work
- next phase
```

---

# 39. Phase-Specific Cursor Prompts

Use these one at a time rather than asking one agent session to build the entire product in one pass.

## 39.1 Phase 0 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 0: repository constitution and
toolchain.

Do not implement product behavior.

Set up strict TypeScript, formatting, linting, Vitest, package scripts, Node LTS
pinning, CI skeleton, documentation skeleton, ADR directory, security files,
and Cursor project rules that require reading MODELLOCK-PLAN.md.

Run every configured check and report results.
```

## 39.2 Phase 1 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 1: versioned schemas, domain
types, canonical JSON serialization, fixtures, and validation errors.

Represent known, unknown, and not-applicable distinctly.

Do not add network code, CLI commands, or discovery.

Add deterministic serialization and schema failure tests.
```

## 39.3 Phase 2 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 2: pure field-level diff and
policy engines.

No file system and no network dependencies are allowed in the core logic.

Implement the full policy matrix, confidence gating, unknown transitions,
stable decisions, and stable exit-code mapping with exhaustive fixtures.
```

## 39.4 Phase 3 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 3: registry loading,
validation, digest verification, cache selection, last-known-good fallback,
and offline behavior.

Do not add provider scrapers yet.

Prove through tests that a malformed or unavailable current registry cannot
replace a valid cached snapshot or create a false failure.
```

## 39.5 Phase 4 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 4: source adapter contract,
bounded safe fetch layer, structured model catalog adapter, deprecation adapter,
and official provider evidence adapters with fixtures.

Live source access must be isolated to scheduled/manual integration tests.

Do not publish registry snapshots yet.
```

## 39.6 Phase 5 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 5: registry normalization,
conflict handling, confidence classification, invariants, deterministic
snapshots, digest continuity, and changelog generation.

A failed source must never erase last-known-good facts.
```

## 39.7 Phase 6 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 6: safe repository discovery
for JavaScript, TypeScript, Python, JSON, YAML, and .env.example.

Never execute repository code.

Use provider context, confidence levels, ignore behavior, source locations, and
realistic false-positive fixtures.
```

## 39.8 Phase 7 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 7: init behavior, configuration
generation, deterministic lockfile creation, safe existing-file behavior, and
proposed update output.

Do not implement the GitHub Action yet.
```

## 39.9 Phase 8 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 8: complete CLI commands and
text, JSON, Markdown, and SARIF reporting.

Preserve stable exit codes and cross-platform behavior.
```

## 39.10 Phase 9 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 9: bundled JavaScript GitHub
Action, minimal permissions, annotations, step summary, artifact reporting, and
safe example workflows.

Basic checking must require no secrets.
```

## 39.11 Phase 10 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 10: CI, scheduled source tests,
registry refresh, deduplicated diagnostic issues, releases, npm provenance,
Action tags, docs deployment, SBOM, and attestations where practical.

No publishing event may be reachable from untrusted pull-request code.
```

## 39.12 Phase 11 prompt

```text
Read MODELLOCK-PLAN.md and implement only Phase 11: complete documentation,
package metadata, Marketplace metadata, examples, security review, and launch
checklist.

Test every documented command.
```

---

# 40. Definition of Done

ModelLock MVP is done only when all of the following are true.

## Product

- A user can initialize in one command.
- Dependencies are detected with locations and confidence.
- A deterministic lockfile is created.
- Current registry facts can be compared with approved facts.
- Policy can warn or fail.
- Changes can be explained.
- An update can be proposed without silent approval.
- GitHub Action works.
- Scheduled checks work.

## Data integrity

- Facts have evidence.
- Facts have confidence.
- Unknown is preserved.
- Conflict is preserved.
- Last-known-good works.
- Snapshots are deterministic.
- Snapshots validate.
- Digests verify.

## Security

- Source code remains local.
- No runtime AI.
- No customer secrets required for checking.
- Minimal GitHub permissions.
- No customer code execution.
- Network bounded.
- Paths bounded.
- Output sanitized.
- Release supply chain reviewed.

## Operations

- Public registry refreshes automatically.
- Failures create deduplicated diagnostic issues.
- Releases are automated.
- Documentation deploys automatically.
- Public infrastructure has no creator cash cost under current service policies.
- Exceptional human intervention is documented honestly.

## Distribution

- npm package published.
- GitHub Action published.
- README works.
- Example repositories work.
- Badge available.
- Static registry pages generated.

## Validation

- 20 public repositories tested.
- Precision target met.
- Outage fallback proven.
- Real retained installations measured.
- Kill conditions reviewed.

---

# 41. Final Strategic Guardrail

ModelLock must remain an information-control product, not drift into a generic AI developer tool.

Its strategic assets are:

1. The `llm.lock.json` standard.
2. The installed repository base.
3. The normalized provider identity graph.
4. Historical evidence-backed model facts.
5. Confidence and conflict semantics.
6. The deployment policy position.
7. Trust earned through conservative failure behavior.
8. Integrations into developer workflows.

The product loses strategic coherence if it becomes:

- A thin dashboard over someone else's catalog.
- A generic model comparison site.
- A chat wrapper.
- A hosted proxy.
- A prompt playground.
- A manually curated newsletter.
- A consulting service.
- A tool requiring constant creator intervention.

The long-term position is:

> Every AI-dependent repository should have an approved, reviewable, machine-readable model dependency state, and ModelLock should be the default implementation of that state.

Build the standard and enforcement layer. Do not build an unnecessary empire around it before the standard is useful.

---

# Appendix A: Official Reference Notes

These references establish current implementation assumptions as of July 20, 2026. They must be rechecked before relying on them in future releases.

1. **xAI Grok 4.5 documentation**  
   xAI documents Grok 4.5 as a frontier model for coding, agentic tasks, and knowledge work and lists its aliases and API characteristics.  
   Source: `https://docs.x.ai/developers/grok-4-5`

2. **xAI model documentation**  
   xAI's model documentation currently recommends Grok 4.5 for general code and other non-specialized model use cases.  
   Source: `https://docs.x.ai/developers/models`

3. **Cursor Grok 4.5 documentation**  
   Cursor documents Grok 4.5 as available for coding and long-running knowledge work.  
   Source: `https://cursor.com/docs/models/grok-4-5`

4. **GitHub Actions billing**  
   GitHub states that Actions usage is free for public repositories using standard GitHub-hosted runners. Usage policies and limits can change.  
   Source: `https://docs.github.com/en/billing/concepts/product-billing/github-actions`

5. **npm public publishing**  
   npm documentation describes publishing packages to the public registry. Account, security, and policy requirements can change.  
   Source: `https://docs.npmjs.com/cli/v12/commands/npm-publish/`

These are implementation inputs, not permanent guarantees. ModelLock's zero-cash architecture must be reviewed if service policies change.

---

# Appendix B: Glossary

**Approved state**  
The model dependency facts accepted by the repository and recorded in `llm.lock.json`.

**Canonical ID**  
The normalized provider-specific identifier used to join evidence.

**Dependency drift**  
A change in an external model fact that occurs without a corresponding repository code change.

**Discovery confidence**  
Confidence that source code actually depends on the detected model.

**Evidence confidence**  
Confidence that the normalized model fact is supported by trustworthy evidence.

**Floating alias**  
An identifier whose underlying implementation may change while the identifier remains the same.

**Last-known-good**  
The most recent valid verified fact or registry snapshot retained when a newer source fails or conflicts.

**Material change**  
A change relevant to configured deployment policy.

**Registry**  
The normalized evidence-backed model-fact dataset consumed by ModelLock.

**Snapshot**  
An immutable dated version of the registry.

**Source adapter**  
Code that safely retrieves, validates, and normalizes one external information source.

---

# Appendix C: Minimal Example Workflow

```yaml
name: ModelLock

on:
  pull_request:
  push:
    branches:
      - main
  schedule:
    - cron: "17 6 * * 1"

permissions:
  contents: read

jobs:
  model-lock:
    runs-on: ubuntu-latest

    steps:
      - name: Check out repository
        uses: actions/checkout@FULL_COMMIT_SHA

      - name: Set up Node.js
        uses: actions/setup-node@FULL_COMMIT_SHA
        with:
          node-version: "CURRENT_PINNED_LTS"

      - name: Check AI model dependencies
        uses: OWNER/model-lock@FULL_COMMIT_SHA
        with:
          config: .llm-lock.yml
          lockfile: llm.lock.json
```

The real documentation must replace placeholders with reviewed pinned values.

---

# Appendix D: Initial Configuration Example

```yaml
version: 1

discovery:
  enabled: true
  languages:
    - javascript
    - typescript
    - python
  include:
    - "src/**/*"
    - ".env.example"
  exclude:
    - "node_modules/**"
    - "dist/**"
    - "build/**"
    - ".venv/**"
    - "**/*.min.js"
  minimumConfidence: medium

policy:
  floatingAliases: warn
  retirementWindowDays: 90
  maximumInputPriceIncreasePercent: 15
  maximumOutputPriceIncreasePercent: 15
  failOnContextDecrease: true
  failOnMaximumOutputDecrease: true
  failOnToolCallingRemoval: true
  failOnStructuredOutputRemoval: true
  failOnVisionRemoval: false

sources:
  staleAfterDays: 7
  onSourceFailure: use-last-known-good
  minimumConfidenceForBlocking: official-verified

output:
  format: text
  writeReport: true
```

---

# Appendix E: Non-Goals Statement for README

ModelLock does not guarantee that two calls to a hosted AI model will behave identically. It does not benchmark model quality, inspect prompts, proxy inference traffic, or prove compliance. It records and evaluates declared model dependency facts using evidence and explicit policy.

---

# Appendix F: Product Statement

> ModelLock gives AI model dependencies the same reviewable discipline that package lockfiles gave software packages: inventory, approved state, evidence, change detection, policy, and explicit updates—without requiring a hosted backend or runtime AI.
