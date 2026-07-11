# Terrarium Grid System

```mermaid
flowchart TD
    A[Grid: 250x250 Cells] --> B[Cell Types]
    B --> C[Soil: Nutrients 200, Regen +0.1/tick]
    B --> D[Water: Water 100, Seepage Source]
    B --> E[Sand: Walkable, Higher Move Cost]
    B --> F[Empty: Default]

    AA[Terrain Transitions with Hysteresis] --> AB[Soil -> Sand: water <= 1 for 12 ticks]
    AB --> AC[On convert: keep 30% nutrients]
    AA --> AD[Sand -> Soil: water >= 30 for 18 ticks]
    AD --> AE[On convert: nutrient floor = 15]

    G[Patches: Connected Terrain Regions] --> H[Soil / Water / Sand Blobs]

    I[Adjacency Rules] --> J[Plants: 4-neighbor spread]
    I --> K[Insects: 8-neighbor move/drink/combat]

    L[Lid State] --> M[Open: Light 100, Evaporation -0.16]
    L --> N[Closed: Light 50, No Evaporation]

    O[Water Dynamics] --> P[Rain: +8 at 11%/tick]
    O --> Q[Drought: -3 at 4%/tick]
    O --> R[Water tile seepage: +1.2/tick]
    O --> S[Adjacent seepage: +0.35 per 4-neighbor water tile]

    T[Insect Movement Model] --> U[Step-charge +1.2/tick, cap 2.5]
    U --> V[Soil step cost: 1.0]
    U --> W[Sand step cost: 1.5]

    X[Move Energy Cost] --> Y[Herbivore: -0.8 per move]
    X --> Z[Carnivore: -0.5 per move]
```

Note: If this diagram conflicts with prose mechanics, use README Section 7 (Canonical Conflict-Resolution Rules) as the source of truth.
