# Monitoring System Design: Time-Band Randomization

## Problem
Channel owners should not be able to predict when monitoring checks occur. Fixed-interval checks (e.g., every 3 hours) are predictable — a channel owner could temporarily unpin or remove content between checks.

## Design Decision: Time-Band Approach

### Why not pure random?
A purely random distribution can cluster checks. For example, in a 24h window with 8 checks, all 8 could randomly land within the first 6 hours — leaving 18 hours unmonitored.

### Solution: Banded Randomization
Divide the monitoring window into **equal-width bands**, then pick **one random time within each band**. This guarantees:
- Even distribution across the entire window
- Unpredictable exact timing within each band
- No clustering

### Formula
```
numBands = ceil(monitoringDurationHours / 3)
bandWidth = duration / numBands
totalChecks = numBands + 1 (random checks + final)
```

### Examples

| Duration | Bands | Band Width | Random Checks | Final | Total |
|----------|:-----:|:----------:|:-------------:|:-----:|:-----:|
| 5h  | 2 | 2.5h   | 2 | 1 | 3 |
| 6h  | 2 | 3h     | 2 | 1 | 3 |
| 12h | 4 | 3h     | 4 | 1 | 5 |
| 17h | 6 | ~2.83h | 6 | 1 | 7 |
| 24h | 8 | 3h     | 8 | 1 | 9 |

### Visual (24h example)
```
|--Band 1--|--Band 2--|--Band 3--|--Band 4--|--Band 5--|--Band 6--|--Band 7--|--Band 8--|FINAL
0h    3h    6h    9h   12h   15h   18h   21h   24h
   ✓          ✓       ✓         ✓      ✓         ✓        ✓       ✓          ✓
   ^random    ^random  ^random  ^each band picks a random time within its window
```

### Edge Protection
- 5 min buffer from each band edge prevents checks clustering at boundaries
- If a band is too small for buffers, check falls at midpoint
- Final check is always at exact monitoring end (triggers fund release)

### Implementation
File: `backend/src/services/MonitoringService.ts` → `generateRandomCheckTimes()`
