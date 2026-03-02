# ADR-0004: Workers AI for Threat Verdicts

**Status**: accepted  
**Date**: 2026-02-20  
**Deciders**: @vvladescu  

## Context

ai-grija.ro analyzes URLs, text messages, and QR codes for phishing threats. Needed an AI model for generating human-readable verdicts in Romanian.

## Options Considered

1. **Workers AI (Llama 3.1 8B)** — Edge inference, no external API, included in CF plan
2. **Anthropic Claude API** — Higher quality, but external latency + API costs
3. **OpenAI GPT-4o-mini** — Good quality, but external dependency + latency
4. **Rule-based only** — No AI, pattern matching only — too rigid for nuanced verdicts

## Decision

**Workers AI with Llama 3.1 8B Instruct** — edge inference with Romanian language support.

### Rationale

1. **Zero latency overhead**: Inference runs on same CF network, no external API call
2. **Cost**: Included in Workers plan, no per-token billing
3. **Privacy**: User data never leaves CF network
4. **Romanian**: Llama 3.1 has adequate Romanian language capability
5. **Fallback**: Rule-based scoring runs independently — AI verdict is additive

## Consequences

- Verdicts are AI-generated but backed by deterministic URL analysis scores
- Model quality limited vs Claude/GPT-4 — acceptable for phishing classification
- Prompt engineering needed for consistent Romanian output format
- AI binding: `c.env.AI.run('@cf/meta/llama-3.1-8b-instruct', { messages })`
