# Image Storage Scale Analysis

> Scope: MinIO object storage (`parking-images` bucket) only.

## Input Assumptions

The following values are illustrative thesis-scale assumptions. Actual numbers scale linearly with vehicle throughput and image size.

| Parameter | Symbol | Value |
|---|---|---|
| Vehicle throughput | `vehicle_throughput` | 500 vehicles/day |
| Images per vehicle (1 check-in + 1 check-out) | `images_per_vehicle` | 2 |
| Average image size | `avg_image_size` | 200 KB |

## Formulas

```
daily_image_count    = vehicle_throughput × images_per_vehicle
daily_storage_size   = daily_image_count × avg_image_size
monthly_storage_size = daily_storage_size × 30
steady_state_size    = daily_storage_size × 30
```

## Worked Example

```
daily_image_count    = 500 × 2           = 1,000 images/day
daily_storage_size   = 1,000 × 200 KB    = 200,000 KB ≈ 195 MB/day
monthly_storage_size = 195 MB × 30       ≈ 5.7 GB/month
steady_state_size    ≈ 5.7 GB
```

## Steady-State Justification

Under a fixed 30-day retention policy, MinIO ILM deletes objects older than 30 days daily. Once the system reaches steady state, the deletion rate equals the ingest rate — each day, roughly 195 MB of new images enter while 195 MB of 30-day-old images expire. The stored volume therefore plateaus at approximately 30 days of accumulated images (~5.7 GB), not unbounded growth. This bounded ceiling is the core justification for the retention policy.

## Note on Lost-Ticket Guest-ID Images

All three image categories — check-in, check-out, and lost-ticket guest-ID — reside in the same `parking-images` bucket and are covered by the single 30-day expiry rule. Lost-ticket guest-ID images are written only on lost-ticket events, which are far rarer than normal vehicle entries. Their volume contribution is negligible and they remain bounded by the same 30-day window. They do not change the steady-state conclusion above.
