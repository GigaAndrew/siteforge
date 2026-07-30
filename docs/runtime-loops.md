# Runtime loops

Declarative loops in `forge-core/loops/definitions.ts`:

| Loop | Activates when | Capabilities |
|---|---|---|
| Evidence | poor text / unsupported facts | repair, knowledge, reliability |
| Audit | missing audit artifacts | audit.* |
| Strategy | low rec confidence / reject | strategy.generate |
| Prototype | browser QA fail | prototype, qa.browser |
| Learning | near complete | lessons, improvements |

Loops terminate on gate pass, max iterations, budget pause, or escalate. The planner boosts nodes belonging to active loops but still picks a single next action each tick.
