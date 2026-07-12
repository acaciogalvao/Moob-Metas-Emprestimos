---
name: Arquitetura GPS do Turno (ShiftGPS)
description: Como o GPS foi integrado ao ciclo de vida do caixa (shift) — auto-start, single watcher, fluxo de dados.
---

# GPS do Turno — Decisões Arquiteturais

## Regra
GPS ativa automaticamente quando o caixa abre e para quando fecha. Se já há um caixa aberto ao montar o app, o GPS inicia imediatamente.

**Why:** Usuário pediu que o GPS fique "sempre ativo enquanto o caixa estiver aberto", sem precisar acionar manualmente.

## Implementação (3 arquivos novos + 4 modificados)

### Novos:
- `src/utils/gpsProcessor.ts` — processador GPS puro (Haversine + EMA α=0.3, limite 180 km/h, descarta >500m em 1s, reduz 50% em curva >90° em <2s, histórico 100 pontos, odômetro)
- `src/hooks/useShiftGPS.ts` — hook React que encapsula um `watchPosition` e o liga ao `isShiftOpen` boolean

### Fluxo de dados:
```
App.tsx
  hasOpenShift = shifts.some(s => s.status === 'OPEN')
  shiftGps = useShiftGPS(hasOpenShift)      ← ÚNICO watcher de GPS do turno
  ↓ props
ShiftControl (gpsSpeedKmh, gpsShiftKm, isGpsActive, gpsAccuracy)
  ↓ props
PainelBordo (externalSpeed, externalShiftKm, isExternalGpsActive, externalAccuracy)
```

### Single-watcher por shift:
- O `useShiftGPS` é a **única** fonte GPS quando caixa está aberto
- O GPS manual do velocímetro flutuante (`isSpeedometerActive`) fica bloqueado quando `hasOpenShift = true` (evita 2 watchers simultâneos)
- `shiftGps.speedKmh` é sincronizado com `currentSpeed` via `useEffect` → alimenta o velocímetro flutuante
- TripTracker mantém seu próprio GPS (uso-caso separado: trip ativo)
- PainelBordo mantém GPS interno como fallback quando caixa fechado, usa externo quando aberto

**How to apply:** Qualquer novo display de velocidade/km com caixa aberto deve consumir `shiftGps` de App.tsx ou receber via props, NÃO criar novo `watchPosition`.
