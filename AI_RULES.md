# AI Development Rules

1. Never modify unrelated modules.
2. Inspect existing implementation before changing anything.
3. Never rewrite working code without a reason.
4. Never delete functionality to solve a bug.
5. Never hardcode secrets or API keys.
6. Never commit .env files.
7. Never expose backend secrets in frontend or mobile code.
8. Do not invent external API responses.
9. Do not invent market prices.
10. Do not calculate financial or business values in the LLM layer.
11. Important calculations must be deterministic backend logic.
12. MongoDB will become the application source of truth.
13. Clerk will handle authentication in a later phase.
14. Blockchain is an audit and provenance layer, not proof of physical crop quality.
15. Every feature must have tests where applicable.
16. Run relevant checks after modifications.
17. Make focused commits and changes.
18. Do not modify another developer's feature without explicit instruction.
19. Do not change public API contracts without explicit instruction.
20. Before major changes, perform impact analysis first.
21. If asked to implement a feature outside the current phase, stop and report that the feature belongs to a later phase.
