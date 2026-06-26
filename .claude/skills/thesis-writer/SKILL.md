---
name: thesis-writer
description: >
  Skill viết quyển đồ án tốt nghiệp SOICT - Đại học Bách Khoa Hà Nội.
  Hướng dẫn viết từng chương với soul, heart & tear — không phải fill template.
  Bám sát tiêu chí đánh giá hội đồng, đặc biệt phần thử nghiệm định lượng.
  Use when user says "viết đồ án", "thesis", "quyển báo cáo", "chương X",
  "đánh giá thực nghiệm", "bảo vệ đồ án", or invokes /thesis.
---

# Skill: Viết Quyển Đồ Án Tốt Nghiệp SOICT

## Triết lý cốt lõi

Quyển đồ án là **bằng chứng lưu trữ 10+ năm** — nó phải có soul. Không phải fill template cho xong. Mỗi trang phải khiến người đọc cảm nhận được:
- Sinh viên **hiểu sâu** vấn đề mình giải quyết (không chỉ code được)
- Có **tư duy kỹ thuật** rõ ràng: tại sao chọn A không chọn B
- Có **kết quả đo lường** cụ thể, không nói suông
- Có **chiều sâu phân tích** — biết cái gì làm tốt, cái gì chưa tốt, tại sao

## Điểm chung của đồ án xuất sắc (từ nghiên cứu)

1. **Narrative mạch lạc**: Đọc từ đầu đến cuối như một câu chuyện — vấn đề → phân tích → giải pháp → chứng minh → kết luận. Không rời rạc.
2. **Định lượng thay vì định tính**: "Hệ thống hoạt động tốt" ≠ xuất sắc. "API check-in p95 = 280ms với 20 concurrent requests, không mất dữ liệu" = xuất sắc.
3. **Trung thực về giới hạn**: Nêu rõ cái chưa làm được, tại sao, và hướng khắc phục. Hội đồng đánh giá cao sự trưởng thành này.
4. **Hình ảnh/bảng biểu có phân tích**: Mỗi hình, mỗi bảng đều có đoạn văn bình luận đi kèm. Không bao giờ chèn hình rồi bỏ trống.
5. **Đóng góp rõ ràng**: Trả lời được "em đã làm gì mà người khác chưa làm / làm khác đi?"
6. **Viết bằng văn xuôi** — ĐATN không phải slide. Câu đủ chủ vị, đoạn văn liền mạch.

## Cấu trúc quyển (linh hoạt, không cứng nhắc 5 chương)

Template SOICT gợi ý 6 chương. Đây là norm nhưng **có thể co giãn** để diễn tả hết cái hay. Nguyên tắc: mỗi chương phải có lý do tồn tại rõ ràng.

### Cấu trúc tham khảo (đề tài ứng dụng)

```
Chương 1: Giới thiệu đề tài
  - Đặt vấn đề (pain thực tế, context)
  - Mục tiêu và phạm vi
  - Định hướng giải pháp (overview, chưa chi tiết)
  - Bố cục đồ án

Chương 2: Khảo sát và Phân tích yêu cầu
  - Khảo sát hiện trạng & giải pháp liên quan
  - So sánh (bảng so sánh có tiêu chí rõ ràng)
  - Phân tích yêu cầu (use case, đặc tả)
  - Yêu cầu phi chức năng

Chương 3: Nền tảng lý thuyết & Công nghệ
  - Chỉ trình bày cái DÙNG, không ôm đồm
  - Mỗi công nghệ: nó là gì + TẠI SAO chọn nó (1-2 câu)
  - Kiến trúc/pattern áp dụng

Chương 4: Thiết kế, Triển khai & Đánh giá
  - Kiến trúc hệ thống
  - Thiết kế CSDL
  - Thiết kế chi tiết các module quan trọng
  - Triển khai (screenshots, flow thực tế)
  - **THỬ NGHIỆM & ĐÁNH GIÁ** ← phần quan trọng nhất

Chương 5: Các giải pháp & Đóng góp nổi bật (optional nhưng rất mạnh)
  - Mỗi đóng góp: Bài toán → Giải pháp → Kết quả đo lường
  - Chương này là "highlight reel" cho hội đồng

Chương 6: Kết luận & Hướng phát triển
  - Tổng kết kết quả (mapping về mục tiêu ban đầu)
  - Hạn chế (trung thực)
  - Hướng phát triển (khả thi, không viển vông)
```

## PHẦN THỬ NGHIỆM & ĐÁNH GIÁ (Critical — Hội đồng đặc biệt coi trọng)

Đây là phần **tạo khác biệt** giữa đồ án trung bình và đồ án xuất sắc. Yêu cầu từ thầy/cô:

### Nguyên tắc: ĐỊNH LƯỢNG, KHÔNG ĐỊNH TÍNH

| Loại đồ án | Cách đánh giá |
|---|---|
| Có thuật toán/ML | Đo accuracy, precision, recall, F1 qua tập test. Bảng so sánh các cấu hình/tham số. Biểu đồ learning curve. |
| Thuần ứng dụng/nghiệp vụ | Đo response time (p50, p95, p99) của API quan trọng. Đo throughput. Đo correctness dưới concurrent load. |
| Cả hai | Kết hợp: đo performance thuật toán + đo performance hệ thống |

### Checklist cho phần thử nghiệm

1. **Dữ liệu demo/thí nghiệm đủ nhiều** — Không test với 3 records. Tạo dataset representative.
2. **Bảng số liệu kết quả** — Mỗi thí nghiệm phải có bảng: input, metric, giá trị đo được.
3. **Biểu đồ** — Bar chart, line chart so sánh. Có label axis rõ ràng, có legend.
4. **Mô tả environment** — Hardware, OS, DB version, network condition. Người khác phải reproduce được.
5. **Testcase list** — Liệt kê các scenario test: normal case, edge case, stress case.
6. **Phân tích kết quả** — Đoạn văn giải thích TẠI SAO kết quả như vậy. Không chỉ paste bảng.

### Template cho 1 thí nghiệm (đề tài ứng dụng)

```
Thí nghiệm X: [Tên — ví dụ: "Đo thời gian phản hồi API check-in dưới tải đồng thời"]

Mục đích: Đánh giá [metric] của [component] trong điều kiện [condition].

Môi trường:
  - Hardware: [CPU, RAM, Disk]
  - Software: [OS, runtime version, DB version]
  - Cấu hình: [tham số quan trọng — pool size, timeout, ...]
  - Dữ liệu: [kích thước dataset, số client đồng thời]

Kịch bản:
  - [Mô tả input: số request, loại payload, điều kiện]
  - Đo: response time (p50, p95, p99), error rate, throughput

Kết quả:
  [BẢNG]
  | Tải (concurrent) | p50 (ms) | p95 (ms) | p99 (ms) | Error % | Throughput |
  |---|---|---|---|---|---|
  | 5 | ... | ... | ... | 0% | ... |
  | 10 | ... | ... | ... | 0% | ... |
  | 20 | ... | ... | ... | 0% | ... |
  | 50 | ... | ... | ... | X% | ... |

  [BIỂU ĐỒ: Line chart — tải vs response time]

Phân tích:
  - Response time tăng [tuyến tính / phi tuyến] khi tải tăng
  - Hệ thống giữ correctness (0% error) đến mốc N
  - Bottleneck xuất hiện ở [tài nguyên nào] vì [lý do]
  - So sánh với requirement đã đặt ở Chương 2: [metric] → ĐẠT / KHÔNG ĐẠT
```

### Các nhóm thí nghiệm phổ biến (chọn theo loại đề tài)

1. **Hiệu năng endpoint/chức năng quan trọng**: response time, throughput dưới các mức tải.
2. **Tính đúng đắn dưới tải đồng thời**: nhiều request tranh chấp cùng tài nguyên → kết quả vẫn đúng (không mất/trùng/sai dữ liệu).
3. **Độ chính xác thuật toán/model**: accuracy, precision, recall, F1 trên tập test có nhãn.
4. **Độ trễ xử lý (latency)**: thời gian từ input → output của thành phần tính toán nặng.
5. **Tính bất biến với thao tác lặp (idempotency) / khả năng phục hồi**: gửi trùng/lỗi → hệ thống xử lý đúng.
6. **End-to-end**: đo toàn luồng nghiệp vụ từ đầu đến cuối.

> **Minh họa (đề tài quản lý bãi đỗ xe)**: (1) response time API check-in/check-out/webhook; (2) N xe vào đồng thời bãi M chỗ → đúng M phiên; (3) precision/recall nhận diện biển số; (4) thời gian frame → plate text; (5) gửi trùng webhook → chỉ 1 giao dịch. Đề tài khác tự chọn nhóm phù hợp.

### Công cụ đo lường gợi ý (nhẹ, local)

- **autocannon** / **k6**: Load test HTTP API (vài trăm → vài nghìn request).
- **Test framework + DB thật** (Jest, pytest...): kiểm thử đồng thời / correctness.
- **Timing thủ công trong code / script**: đo latency thành phần tính toán.
- **Tập test có nhãn + script tính metric**: đo accuracy/precision/recall.

> **Lưu ý**: KHÔNG cần infra load-test phức tạp. Mục tiêu là có số liệu đưa vào quyển, không phải build CI throughput gate.

## Phân định ĐÓNG GÓP của mình vs cái đi MƯỢN (Cực kỳ quan trọng)

Đây là chỗ nhiều sinh viên mắc lỗi và bị hội đồng "bắt bài". Phải phân biệt rạch ròi:

### Nguyên tắc vàng

| Loại | Đặt ở chương nào | Cách trình bày |
|---|---|---|
| Thư viện/model/thuật toán có sẵn (của người khác) | Chương 3 (Nền tảng lý thuyết) | Mô tả nó là gì, hoạt động ra sao, cite nguồn. KHÔNG nhận là của mình. |
| Tích hợp/chỉnh sửa/glue code của mình | Chương 4 (Triển khai) hoặc Chương 5 (Đóng góp) | Nêu rõ "đồ án tích hợp/sửa đổi" và phần nào là tự làm. |
| Giải pháp/logic tự nghĩ ra | Chương 5 (Đóng góp nổi bật) | Đây mới là đóng góp thật. Bài toán → giải pháp → kết quả. |

### Ví dụ minh họa (mỗi đề tài tự ánh xạ)

**KHÔNG phải đóng góp** (để ở Chương 3, mô tả + cite):
- Pre-trained model / thư viện ML có sẵn (model detect, OCR engine, model NLP...).
- Pipeline mã nguồn mở lấy từ GitHub/paper — PHẢI ghi rõ nguồn, mô tả như "nền tảng kế thừa".
- Framework, SDK, database engine, cổng thanh toán — công nghệ nền.
- Tính năng built-in của một công cụ (ví dụ cơ chế khóa của DBMS) — mô tả ở Chương 3.

**LÀ đóng góp** (để ở Chương 5):
- **Module tự thiết kế** giải quyết một vấn đề cụ thể của đề tài (tiền xử lý, chuẩn hóa dữ liệu, thuật toán tự viết, business logic riêng).
- **Tích hợp/Orchestration**: cách ghép nhiều thành phần rời rạc thành một luồng nghiệp vụ hoàn chỉnh, nhất quán — đây là công sức kỹ thuật thật.
- **Thiết kế đảm bảo thuộc tính khó** (đúng đắn dưới tải, idempotency, bảo mật...): bản thân từng cơ chế có thể là built-in, nhưng *cách kết hợp để giải bài toán cụ thể* là của mình.

> **Minh họa cụ thể (đề tài quản lý bãi đỗ xe)**: Model YOLOv8, pipeline LPD 2-pass (detect vùng biển → đọc ký tự), OCR engine là cái MƯỢN → mô tả + cite ở Chương 3. Còn **module chuẩn hóa biển số tự thiết kế** và **tích hợp LPD + backend + gate + payment thành luồng thống nhất** mới là ĐÓNG GÓP → Chương 5. Mỗi đề tài khác tự ánh xạ theo logic tương tự.

### Cách diễn đạt chuẩn để không bị hiểu nhầm

- Cái đi mượn: *"Đồ án sử dụng [model/thư viện] [cite] để [chức năng]. Thành phần này được phát triển sẵn và..."*
- Cái tích hợp: *"Đồ án kế thừa [pipeline/mã nguồn mở] [cite] và tích hợp lại để phù hợp với [bối cảnh đề tài], đồng thời bổ sung [phần tự làm]."*
- Cái tự làm: *"Đóng góp của đồ án là [giải pháp X], được trình bày chi tiết dưới đây."*

> **Lý do quan trọng**: Hội đồng đánh giá cao sự **trung thực học thuật**. Nhận vơ cái không phải của mình = rủi ro lớn khi bị hỏi sâu. Ngược lại, một đóng góp nhỏ nhưng *được phân tích sâu và đo lường rõ ràng* (như normalizer + integration) còn ghi điểm hơn là khoe model AI mà không hiểu bên trong.

## Chương 3 — Nền tảng lý thuyết: viết thế nào cho đúng

Mục tiêu: trang bị cho người đọc đủ kiến thức để hiểu các chương sau. KHÔNG phải viết lại sách giáo khoa.

### Nguyên tắc
- Chỉ trình bày cái **thực sự dùng** trong đồ án. Không dùng thì không đưa vào.
- Với mỗi công nghệ/thuật toán: (i) nó là gì, (ii) ý tưởng/cách hoạt động cốt lõi, (iii) **tại sao chọn nó cho đồ án này**.
- Với thuật toán trong thư viện: nêu *ý tưởng thuật toán* ở mức đủ hiểu, cite nguồn gốc. Không cần chứng minh toán học đầy đủ trừ khi đó là trọng tâm đề tài.

### Độ sâu phù hợp
- Mô tả thuật toán ở mức "đủ để người đọc hiểu tại sao nó giải được bài toán", không viết lại toàn bộ kiến trúc/lý thuyết của nó.
- Phân biệt rõ: khái niệm nền (mô tả ngắn) vs cơ chế mà đóng góp của mình dựa vào (mô tả kỹ hơn vì Chương 5 sẽ dùng).
- Không lạm dụng giới thiệu công nghệ phổ biến (kiểu "React là gì" dài 5 trang). Ai cũng biết thì nói ngắn.

> **Minh họa (đề tài quản lý bãi đỗ xe)**: Với YOLOv8 — giải thích họ one-stage detector, ý tưởng chia ảnh thành grid và dự đoán box + class trong một forward pass, lý do nhanh phù hợp real-time, cite paper; KHÔNG cần viết lại backbone. Với cơ chế khóa của DBMS — giải thích đủ kỹ vì Chương 5 sẽ dùng nó để kể đóng góp về xử lý đồng thời.

> **Mẹo liên kết Chương 3 ↔ Chương 5**: Chương 3 đặt nền ("công cụ X có cơ chế Y"), Chương 5 dùng nền đó để kể đóng góp ("đồ án áp dụng cơ chế Y theo cách Z để giải bài toán cụ thể"). Hai chương phải khớp nhau.

## Phong cách viết

### DO (Nên)
- Viết văn xuôi, đoạn văn liền mạch. Câu đủ chủ vị.
- Mỗi hình/bảng PHẢI có đoạn giải thích ngay sau.
- Dùng "đồ án" thay vì "em/tôi" khi có thể. Ví dụ: "Đồ án áp dụng..." thay vì "Em đã làm..."
- Trích dẫn IEEE. Chỉ cite cái thực sự đọc.
- Consistent terminology toàn quyển (chọn 1 từ rồi dùng xuyên suốt).
- Giải thích WHY, không chỉ WHAT. "Đồ án dùng advisory lock VÌ..." 
- Kết nối chương: cuối mỗi chương có 1-2 câu dẫn sang chương tiếp.

### DON'T (Không nên)
- Viết kiểu gạch đầu dòng (ĐATN không phải slide).
- Chèn hình không giải thích.
- Copy/paste code block dài vào quyển (tóm tắt logic, refer appendix nếu cần).
- Nói "hệ thống hoạt động tốt" mà không có số liệu.
- Viết chương công nghệ dài 20 trang giới thiệu React là gì (ai cũng biết).
- Nêu hướng phát triển viển vông ("áp dụng AI để...") mà không có cơ sở.

## Khi được yêu cầu viết 1 chương/section cụ thể

Quy trình:
1. Hỏi rõ: chương nào, section nào, có data/kết quả gì chưa?
2. Đọc code/test liên quan trong repo để lấy thông tin chính xác.
3. Viết bằng văn xuôi, đúng tone academic Việt Nam.
4. Output LaTeX (bám template SOICT đã có trong project).
5. Mỗi claim phải có backing: code evidence, test result, hoặc measurement.
6. Suggest bảng/biểu đồ cần tạo kèm theo.

## Khi được yêu cầu review 1 chương đã viết

Quy trình:
1. Đọc toàn bộ chương.
2. Check theo tiêu chí:
   - [ ] Narrative liền mạch? Hay rời rạc bullet?
   - [ ] Mỗi hình/bảng có giải thích?
   - [ ] Có số liệu định lượng? (đặc biệt chương 4-5)
   - [ ] WHY rõ ràng? Hay chỉ mô tả WHAT?
   - [ ] Consistent terminology?
   - [ ] Kết nối với chương trước/sau?
   - [ ] Tự tin đứng trước hội đồng defend được?
3. Output: Feedback cụ thể, chỉ ra chỗ yếu + gợi ý cách sửa.

## Tiêu chí đánh giá hội đồng (để tự kiểm)

Hội đồng SOICT thường đánh giá theo các khía cạnh:

| Khía cạnh | Trọng số | Điểm mạnh cần thể hiện |
|---|---|---|
| Nội dung kỹ thuật | Cao | Giải pháp có chiều sâu, không surface-level |
| Khối lượng công việc | Cao | Nhiều feature, nhiều edge case đã xử lý |
| Chất lượng quyển | Trung bình-Cao | Viết tốt, trình bày đẹp, logic |
| Thử nghiệm/Đánh giá | Cao | Có số liệu, có phân tích, có so sánh |
| Demo | Trung bình | Chạy được, flow mượt, xử lý edge case |
| Trả lời phản biện | Trung bình | Hiểu sâu, không lúng túng |

## Câu hỏi phản biện thường gặp (chuẩn bị khi viết)

Khi viết mỗi section, tự hỏi: "Nếu thầy hỏi X thì mình trả lời gì?". Các dạng câu hỏi phổ biến:

- **Lựa chọn công nghệ**: "Tại sao chọn công nghệ A mà không phải B?"
- **Giới hạn/bottleneck**: "Giải pháp này có điểm nghẽn gì? Nếu tải tăng gấp 100 lần thì sao?"
- **Đánh giá định lượng**: "Kết quả đo được bao nhiêu? Đo trên tập dữ liệu/điều kiện nào?"
- **Xử lý lỗi/edge case**: "Nếu thành phần X fail thì hệ thống xử lý thế nào?"
- **Khác biệt cạnh tranh**: "So với giải pháp có sẵn trên thị trường, đồ án hơn ở điểm nào?"
- **Khả năng mở rộng**: "Nếu mở rộng quy mô thì kiến trúc có chịu được không?"
- **Phân định đóng góp**: "Phần nào em tự làm, phần nào dùng lại của người khác?" ← câu này gần như chắc chắn bị hỏi.

> **Minh họa (đề tài quản lý bãi đỗ xe)**: "Tại sao chọn PostgreSQL thay vì MongoDB?", "Accuracy nhận diện biển số bao nhiêu %, đo trên tập nào?", "Nếu webhook thanh toán fail thì xe có ra được không?", "Cơ chế khóa có bị nghẽn khi nhiều xe vào cùng lúc không?".

**Viết sao cho quyển tự trả lời được những câu này mà không cần giải thích thêm.**

## Quy định hành chính & hình thức (KHÔNG được sai)

Đây là nhóm lỗi "mất điểm oan" và để lại vết lâu dài vì quyển online lưu trữ dài hạn, có hậu kiểm bởi cả cộng đồng. Kiểm tra kỹ trước khi nộp.

### Độ dài
- **60–80 trang nội dung** — chỉ tính các chương nội dung, KHÔNG tính mục lục, tài liệu tham khảo, phụ lục.
- Không viết quá ngắn (thiếu chiều sâu) cũng không quá dài (loãng, nhồi nhét). Nếu vượt 80 trang nhiều → cân nhắc đẩy chi tiết phụ vào phụ lục.

### Tên đề tài
- **Phải khớp chính xác tên trong Phiếu giao nhiệm vụ ĐATN.**
- Muốn đổi tên: trao đổi với giảng viên hướng dẫn SỚM (trước khi Đại học ban hành Quyết định). Sau khi có Quyết định thì **không đổi được nữa**.

### Thông tin định danh — phải chính xác tuyệt đối
- Trường: **Trường Công nghệ Thông tin và Truyền thông (CNTT&TT)**
- Khoa: **Khoa Khoa học máy tính** 
- Giảng viên hướng dẫn: **TS. Nguyễn Thanh Hùng** (đúng học hàm/học vị — là **TS.**, KHÔNG ghi nhầm thành PGS.TS.).
- Kiểm tra lại tên trường/khoa/GVHD ở: bìa, bìa lót, lời cảm ơn, phiếu giao nhiệm vụ.

### Hình thức
- **Màu chữ: đen mặc định.** Không dùng màu khác cho nội dung (trừ trường hợp hợp lý như syntax highlight trong code listing, link...). Kiểm tra kỹ vì nhiều bạn vô tình để chữ màu khác do copy-paste.
- Thống nhất font, căn lề hai bên, margin, đánh số trang, style hình/bảng theo template SOICT.

### Liêm chính học thuật khi dùng AI
- Được phép dùng AI hỗ trợ, NHƯNG nguyên tắc bất di bất dịch: **không bịa đặt nội dung, không bịa tài liệu tham khảo.**
- Mọi số liệu thực nghiệm phải là số đo thật. Mọi citation phải là tài liệu có thật, đã đọc.
- Quyển online lưu lâu dài + hậu kiểm cộng đồng → bịa đặt là rủi ro nghiêm trọng, có thể bị phát hiện sau nhiều năm.

> **Khi viết hộ nội dung**: skill này TUYỆT ĐỐI không tự bịa số liệu hay tài liệu tham khảo. Nếu chưa có data thật, để placeholder `[CHỜ ĐO]` / `[CẦN CITE NGUỒN THẬT]` và nhắc người dùng điền, thay vì tạo số liệu giả.

## Quy trình bảo vệ & cách tính điểm

Hiểu quy trình giúp viết quyển và chuẩn bị demo đúng trọng tâm cho từng đối tượng người đọc (GVHD, phản biện, hội đồng).

### Các mốc & quy trình
- **Mốc phản hồi đầu tiên (ví dụ 14/6)**: GVHD phản hồi cho Trường để thống kê ban đầu. GVHD vẫn có thể chuyển trạng thái sang **Từ chối** cho tới khi sinh viên đã nộp quyển → phải tiếp tục cố gắng đến phút chót, không chủ quan.
- **Thành lập hội đồng theo lĩnh vực**: các đề tài cùng mảng về chung hội đồng (ví dụ đề tài Web chung hội đồng, đề tài AI chung hội đồng). Mỗi hội đồng thường có **3 hoặc 5** giảng viên.
- Sau khi GVHD đồng ý → Trường tổng hợp, trình Đại học ký **Quyết định thành lập Hội đồng** (gồm tên GV, tên SV, tên đề tài).
- Trường/Khoa phân công **01 giảng viên phản biện**. Sinh viên **báo cáo + demo chương trình** cho GV phản biện.

### Cách tính điểm
- **Điểm Quá trình** = (Điểm GV hướng dẫn + Điểm GV phản biện) / 2
- **Điểm Cuối kỳ** = Trung bình điểm của cả Hội đồng tại buổi bảo vệ (chỉ **trình bày**, **không demo**).

### Hệ quả khi viết quyển & chuẩn bị
- **GV phản biện được xem demo** → demo phải chạy mượt, xử lý được edge case; quyển phải mô tả đủ để phản biện đối chiếu với sản phẩm thật.
- **Hội đồng chỉ nghe trình bày, không demo** → quyển và slide phải tự chứng minh được kết quả: cần **bảng số liệu, biểu đồ, screenshot** rõ ràng vì hội đồng không thấy hệ thống chạy trực tiếp. Đây là lý do nữa để phần thử nghiệm định lượng phải mạnh.
- Viết quyển sao cho người **chưa từng xem demo** vẫn hiểu hệ thống làm được gì và tin vào kết quả.

## Tài liệu tham chiếu trong repo

Khi viết, ĐỌC các file dưới đây để lấy context chính xác thay vì hỏi lại user:

### Quyết định kiến trúc & scope (đọc khi viết Chương 4-5-6)
- `docs/decisions/2026-06-23-edge-ingest-scope-decision.md` — Edge ingest: giữ code, ẩn demo, lý do, câu trả lời mẫu cho hội đồng, perf test scope (3 flow: checkin, checkout, payment)

### Spec yêu cầu & thiết kế (đọc khi viết Chương 2-4)
- `.kiro/specs/unified-checkin-kiosk/requirements.md` — Yêu cầu chi tiết kiosk check-in (subscriber + casual, camera, LPD, gate)
- `.kiro/specs/unified-checkout-flow/requirements.md` — Yêu cầu checkout + payment intent
- `.kiro/specs/card-pool-management/requirements.md` — Yêu cầu quản lý thẻ gửi xe
- `.kiro/specs/gate-control-settings/requirements.md` — Yêu cầu cấu hình gate

### Perf/load test (đọc khi viết phần thử nghiệm)
- `.kiro/specs/load-perf-disaster-tests/tasks.md` — Kế hoạch + kết quả load test 3 endpoint chính

### Steering & conventions (đọc khi cần hiểu kiến trúc tổng)
- `AGENTS.md` — Coding conventions, layering, env, commands
- `.kiro/steering/payos-checkout.md` — PayOS integration details

## Tài liệu tham chiếu trong repo

Khi viết các chương, skill này nên đọc các file dưới đây để lấy số liệu thực, thiết kế, và kết quả thử nghiệm. Dùng `#[[file:...]]` syntax để include khi cần.

### Thử nghiệm & Đánh giá (Chương 4/5)

| Tài liệu | Đường dẫn | Nội dung |
|-----------|-----------|----------|
| Load test report (FINAL) | #[[file:be/load-test-results/REPORT.md]] | Bảng kết quả 14 scenario, key takeaways, phân tích error rate, cold-start, disaster tests — **sẵn dùng cho phần thử nghiệm định lượng** |
| Load test JSON (raw data) | #[[file:be/load-test-results/load-test-results.json]] | Số liệu gốc: p50, p95, RPS, error rate, assertions. Dùng để vẽ biểu đồ/bảng chính xác |
| Load test config | #[[file:be/load-tests/config.js]] | Tham số thử nghiệm: connections, duration, timeouts — mô tả environment |
| Load test scenarios | #[[file:be/load-tests/scenarios/]] | Source code 5 kịch bản: load, perf, disaster-db, disaster-race, disaster-minio |

### Thiết kế hệ thống (Chương 4)

| Tài liệu | Đường dẫn | Nội dung |
|-----------|-----------|----------|
| DB schema & migrations | #[[file:db/init/]] | Toàn bộ SQL schema, indexes, constraints |
| Backend entrypoint | #[[file:be/app.js]] | Middleware stack, route mounting, session config |
| Docker Compose | #[[file:docker-compose.yml]] | Kiến trúc triển khai: postgres, minio, backend, frontend, LPD |

### Specs (Requirements → Design → Tasks)

| Tài liệu | Đường dẫn | Nội dung |
|-----------|-----------|----------|
| Unified checkout flow | #[[file:.kiro/specs/unified-checkout-flow/]] | Luồng checkout (cash/card/monthly), payment intent v2 |
| Unified checkin kiosk | #[[file:.kiro/specs/unified-checkin-kiosk/]] | Luồng check-in (RFID + LPD + manual) |
| Card pool management | #[[file:.kiro/specs/card-pool-management/]] | Quản lý pool thẻ, issue/revoke/lost |
| Gate control settings | #[[file:.kiro/specs/gate-control-settings/]] | Cấu hình cổng, lane, camera |
| Load/perf/disaster tests | #[[file:.kiro/specs/load-perf-disaster-tests/]] | Requirements + design cho bộ test tải |
| Edge gateway | #[[file:.kiro/specs/edge-gateway-simulator/]] | Mô phỏng thiết bị edge (camera, barrier) |
| Fee calculation engine | #[[file:.kiro/specs/fee-calculation-engine/]] | Engine tính phí (theo giờ, theo loại xe, penalty) |

### Concurrency & Correctness (Chương 5 — Đóng góp)

| Tài liệu | Đường dẫn | Nội dung |
|-----------|-----------|----------|
| Checkin concurrency test | #[[file:be/__tests__/services/checkin.concurrency.test.js]] | Test N xe vào đồng thời, FOR UPDATE, capacity atomic |
| Cardpool concurrency test | #[[file:be/__tests__/services/checkin.cardpool.concurrency.test.js]] | Test tranh chấp card pool |
| Checkout service | #[[file:be/services/checkout.service.js]] | settleCheckout, finalizeSessionIfOpen, webhook finalize |
| Payment intent service | #[[file:be/services/paymentIntent.service.js]] | createOrReuseIntent, FOR UPDATE serialization |
| Checkin concurrency fixes doc | #[[file:docs/CHECKIN_CONCURRENCY_FIXES.md]] | Tài liệu giải thích các cơ chế đảm bảo đồng thời |

### LPD / Nhận diện biển số (Chương 3 + 5)

| Tài liệu | Đường dẫn | Nội dung |
|-----------|-----------|----------|
| LPD Technical Analysis | #[[file:LPD_Technical_Analysis.md]] | Phân tích kỹ thuật pipeline detect + OCR |
| LPD System Documentation | #[[file:LPD_System_Documentation.md]] | Tài liệu hệ thống LPD đầy đủ |
| Plate normalizer | #[[file:Licence-Plate-Detection-Recognition-Recording/normalizer.py]] | Module chuẩn hóa biển số (đóng góp) |
| Normalizer tests | #[[file:Licence-Plate-Detection-Recognition-Recording/tests/unit/test_normalizer.py]] | Property-based tests cho normalizer |
| License-Plate-Recognition (GitHub) | https://github.com/trungdinh22/License-Plate-Recognition | Repo tham khảo pipeline nhận diện biển số — cite ở Chương 3 khi mô tả nền tảng kế thừa |

### Tổng quan dự án

| Tài liệu | Đường dẫn | Nội dung |
|-----------|-----------|----------|
| README | #[[file:README.md]] | Overview, tech stack, architecture diagram |
| AGENTS.md | #[[file:AGENTS.md]] | Coding conventions, design philosophy, test commands |

> **Cách dùng**: Khi viết section cần số liệu (ví dụ phần thử nghiệm), đọc file tương ứng để lấy data thật. KHÔNG bịa số — nếu file chưa có data, để `[CHỜ ĐO]`.

## Trigger
Activate khi user nói: "viết đồ án", "thesis", "quyển báo cáo", "chương", "đánh giá thực nghiệm", "bảo vệ", "defense", "/thesis", "viết chapter", "phần thử nghiệm"
