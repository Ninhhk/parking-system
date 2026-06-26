# Decision: Edge Ingest — Ẩn khỏi demo, giữ code, ghi hướng phát triển

**Date:** 2026-06-23  
**Status:** ACCEPTED  
**Participants:** Student + AI assistant

---

## Bối cảnh

Edge ingest = pipeline tự động: device (camera/reader) → gateway → `POST /edge/events/ingest` → dedup + advisory lock + correlation → session create/close → gate state update.

Backend hoàn chỉnh:
- Controller, service, repo, middleware (API-key auth timing-safe)
- Dedup by event_id, advisory lock per lane, LPD correlation window
- EXIT-by-identity (IC_CARD/UHF/LPD)
- Retry failed events
- Integration tests pass (concurrency, dedup, correlation)

Frontend có:
- `/admin/edge-ops` — event list, filter, retry, active sessions
- `/gate-light/[laneId]` — gate indicator (polling 1.5s)
- `edge-simulator/` CLI — interactive + auto mode

## Vấn đề

1. **Không có hardware thật** — không demo live camera→barrier→mở
2. **CLI fail** — chạy `npm run load-test` toàn lỗi, fix = effort cho 0 bullet báo cáo
3. **Đã bỏ khỏi perf test scope** — không có số liệu p95/concurrency để trình bày
4. **Redundant với checkin kiosk** — cùng kết quả (tạo session, mở gate) nhưng checkin có UI + camera + LPD real trong browser. Edge chỉ thêm 1 form/curl trigger = fake input, không chứng minh thêm gì
5. **Simulator UI proposal bị reject** — vì nó giống hệt checkin form, hội đồng sẽ hỏi "khác gì?"

## Các phương án đã xem xét

| Option | Effort | Giá trị defense |
|--------|--------|----------------|
| A. Build simulator page | 2-4h | ~0 (redundant checkin) |
| B. Lane monitor dashboard | 6-10h | Over-engineered |
| C. Fix CLI + demo curl | 1-2h | ~0 (đã bỏ khỏi perf) |
| **D. Ẩn nav, giữ code, ghi future work** | **5 phút** | **Đúng scope** |

## Quyết định

**Option D.**

- Gỡ "Edge Ops" khỏi admin sidebar (`Sidebar.jsx`)
- Giữ nguyên: page `/admin/edge-ops`, backend routes/services, integration tests, CLI
- Trong báo cáo: ghi edge ingest vào "Hướng phát triển" — kiến trúc sẵn sàng khi có thiết bị thật

## Lý do

1. Feature "mở rộng" không có trigger thật → không demo → không có bullet đánh giá
2. Correctness đã chứng minh qua integration test → đủ cho 1 dòng báo cáo kiến trúc
3. Dồn effort vào 3 flow có giá trị defense: checkin (kiosk+camera+LPD), checkout (payment intent), payment (concurrency+double-charge prevention)
4. Senior-review: "có cần build thêm gì?" → Không. Over-engineering nếu build thêm UI cho thứ không demo được.

## Hậu quả

- Edge Ops console vẫn accessible bằng URL trực tiếp (không xóa page)
- Integration test vẫn chạy trong CI → code không rot
- Nếu sau defense muốn kết nối hardware → chỉ cần: fix CLI env, gắn lại nav link, done

## Câu trả lời cho hội đồng (nếu hỏi)

> "Edge ingest là module kiến trúc cho hướng mở rộng — tách device khỏi business logic, idempotent ingestion với advisory lock per lane, LPD correlation window. Backend + integration test đầy đủ. Chưa triển khai hardware nên không đưa vào scope đánh giá hiệu năng."

## Kết luận perf test scope

Giữ lại 3 endpoint có UI flow rõ ràng + có thể manual test + demo trước hội đồng:
1. **Checkin** — kiosk, camera, LPD, gate indicator
2. **Checkout** — payment intent creation, PayOS redirect
3. **Payment confirmation** — webhook, concurrency, double-charge prevention
