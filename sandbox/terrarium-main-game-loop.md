# Terrarium Main Game Loop

```mermaid
flowchart TD
    A[Start Tick] --> B[Advance Tick and Toggle Day/Night]
    B --> C[Process Weather and Per-Cell Resources]
    C --> D[Update Global Gases O2/CO2]
    D --> E[Process Plants]
    E --> F[Process Insects]
    F --> G[Cleanup Dead Lists]
    G --> H[Evaluate Win/Lose Conditions]
    H -->|Lose| I[Game Over]
    H -->|Continue| A

    J[Player Action: Toggle Lid] --> K[Open: Light 100 and Evaporation ON]
    J --> L[Closed: Light 50 and Evaporation OFF]
```
