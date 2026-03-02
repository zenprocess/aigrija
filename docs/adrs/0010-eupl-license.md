# ADR-0010: EUPL-1.2 License

**Status**: accepted
**Date**: 2026-03-02
**Deciders**: @vvladescu

## Context

ai-grija.ro is being open-sourced for submission to Code4Romania and the broader Romanian civic tech ecosystem. We need a license that:

- Provides copyleft protection (derivatives stay open)
- Is recognized and recommended by EU institutions
- Is compatible with major open-source licenses (GPL family)
- Is available in all EU official languages (including Romanian)
- Is designed for public sector and civic tech use cases
- Does not create friction for Romanian public institutions adopting the code

## Options Considered

### Option A: MIT License

- **Copyleft**: None — anyone can take the code proprietary
- **EU recognition**: Accepted but not EU-native
- **Tradeoff**: Maximally permissive; no guarantee derivatives remain open. Rejected because civic tech infrastructure should stay open.

### Option B: GNU AGPL-3.0

- **Copyleft**: Strong, including network use (SaaS loophole closed)
- **EU recognition**: Widely used but US-origin
- **Tradeoff**: Strongest copyleft for web services. Rejected because EUPL-1.2 is equivalent for our use case and is EU-native with explicit public sector backing.

### Option C: Apache-2.0

- **Copyleft**: None — permissive with patent grant
- **EU recognition**: Accepted but not EU-native
- **Tradeoff**: No copyleft. Rejected for same reason as MIT.

### Option D: EUPL-1.2

- **Copyleft**: Yes — derivatives must remain under EUPL-1.2 or compatible license
- **EU recognition**: Developed and maintained by the European Commission
- **Compatibility**: Explicitly compatible with GPL-2.0+, LGPL-2.1+, AGPL-3.0, MPL-2.0, EPL-1.0, CDDL-1.0, and others (Appendix)
- **Languages**: Available in all 23 EU official languages including Romanian
- **Public sector**: Designed for EU public sector software; explicitly covers SaaS use

## Decision

**Option D: EUPL-1.2**

### Rationale

1. **EU-native**: Authored by the European Commission; carries institutional credibility for Code4Romania and Romanian public sector partners
2. **Copyleft with compatibility**: Derivatives must remain open, but the explicit compatibility list avoids license proliferation issues when integrating GPL/LGPL components
3. **SaaS coverage**: Like AGPL, EUPL-1.2 Art. 5 covers network use — running a modified version as a service requires sharing source
4. **Romanian available**: License text is available in Romanian, reducing legal ambiguity for Romanian-jurisdiction deployments
5. **OSI approved**: Recognized as an open-source license, compatible with open-source submission requirements

### Implementation

1. Add `LICENSE` file with EUPL-1.2 text (English version) to repository root
2. Add SPDX identifier to `package.json`: `"license": "EUPL-1.2"`
3. New source files may include the SPDX header if desired: `// SPDX-License-Identifier: EUPL-1.2`
4. Include link to Romanian translation in `README.md` legal section

## Consequences

**Positive**:
- Strong copyleft ensures civic infrastructure stays open
- EU institutional backing simplifies adoption by Romanian public institutions
- Explicit compatibility list avoids friction when using GPL components

**Negative**:
- Less familiar than MIT/Apache to many developers; may require explanation
- SaaS copyleft (Art. 5) means any organization running a modified version must publish changes — this is intentional but may deter some commercial adopters

**Risks**:
- License compatibility edge cases with non-listed licenses — consult EUPL compatibility matrix before adding new dependencies with strong copyleft licenses
