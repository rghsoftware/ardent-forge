# Session Patterns

## 2026-04-11T18:59:41.493Z (session 49862042)
- ADR: ADR-021-01, ADR-021-02, ADR-021-03, ADR-021-04, ADR-021-05

## 2026-04-16T15:41:57.186Z (session fb2c6f90)
- | **GymId + UserId Brand Migration** | High | Planned -- all 6 F019 consumer sites + `entityId` tightening, ADR-013 flip to Accepted |
- **Key decision:** New `useFrequentExercises` hook + new adapter method (set-count aggregation) rather than repurposing the existing recency hook.
- Advisor unavailable -- reasoning in-thread. **Decision: Option A (server-side RPC)** -- client-side aggregation would transfer hundreds of rows per session to compute an 8-item list; a purpose-built R

## 2026-04-16T15:41:57.314Z (session fb2c6f90)
- | **GymId + UserId Brand Migration** | High | Planned -- all 6 F019 consumer sites + `entityId` tightening, ADR-013 flip to Accepted |
- **Key decision:** New `useFrequentExercises` hook + new adapter method (set-count aggregation) rather than repurposing the existing recency hook.
- Advisor unavailable -- reasoning in-thread. **Decision: Option A (server-side RPC)** -- client-side aggregation would transfer hundreds of rows per session to compute an 8-item list; a purpose-built R

