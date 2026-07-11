# Terrarium Plants Lifecycle

```mermaid
flowchart TD
    A[Plant Tick] --> B[Drain Nutrients by Growth Stage]
    B --> C{Good Conditions?<br/>Light >= 50, Water > 30, Nutrients > 20}

    C -->|Yes| D[Grow +1 with CO2 penalty]
    C -->|No| E[Wilt and shrink -0.5]

    E --> F{Growth < 10?}
    F -->|Yes| G[Die and return +50 nutrients]
    F -->|No| H[Remain Wilted]

    D --> I{Stage by Growth}
    I --> I1[Seed: 0-19]
    I --> I2[Sprout: 20-79]
    I --> I3[Mature: 80-100]

    I3 --> J{Can Reproduce?<br/>Nutrients > 50 and chance passes}
    J -->|Yes| K[Spawn seed on 4-neighbor soil, parent nutrients -10]
    J -->|No| L[No offspring this tick]

    H --> M{3 consecutive good ticks?}
    M -->|Yes| N[Recover from wilt]
    M -->|No| H
```

Note: If this diagram conflicts with prose mechanics, use README Section 7 (Canonical Conflict-Resolution Rules) as the source of truth.
