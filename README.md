# LinguaCompanion

LinguaCompanion là ứng dụng học ngoại ngữ theo chu trình **Plan → Do → Reflect**. Giáo viên lập lớp, giao mục tiêu và tài liệu. Sinh viên tham gia qua mã hoặc QR, lập kế hoạch tuần, luyện kỹ năng, hỏi gia sư theo tài liệu và xem tiến độ tính từ hoạt động thực tế.

## 1. Mở ứng dụng trên máy

Cài Node.js 22 trở lên cùng npm. Từ thư mục chứa `package.json`, chạy các lệnh PowerShell sau. Trên macOS/Linux, dùng `cp .env.example .env.local` cho bước sao chép.

```powershell
npm ci
Copy-Item .env.example .env.local
npm run dev
```

Mở [trang chủ](http://localhost:3000). Bạn có thể lật thẻ hội thoại và nghe phát âm trước khi cấu hình dịch vụ. Để dùng tài khoản và lớp học, hoàn tất phần Supabase bên dưới. Khởi động lại Next.js sau khi sửa `.env.local`.

## 2. Tạo dự án Supabase

1. Tạo một project **Free** trong Supabase. Mở **SQL Editor → New query**, dán toàn bộ nội dung [supabase/schema.sql](supabase/schema.sql) và chạy một lần trên project mới. Script tạo các bảng, khóa ngoại, trigger, RLS, RPC và bucket riêng `materials` trong một giao dịch.
2. Mở **Connect** hoặc **Project Settings → API Keys**, lấy URL dự án, khóa public/anon và khóa secret/service_role. Điền vào `.env.local` theo bảng bên dưới.
3. Trong **Authentication**, bật đăng nhập bằng email và mật khẩu. Đặt **Site URL** thành `http://localhost:3000` và thêm `http://localhost:3000/auth/callback**` vào **Redirect URLs**. Khi bật xác nhận email, mở liên kết xác nhận bằng trình duyệt dùng để đăng ký.
4. Tạo một tài khoản **Giáo viên** và một tài khoản **Sinh viên** để thử cả hai vai trò. Trigger tạo hồ sơ từ dữ liệu đăng ký. Mỗi giáo viên chỉ quản lý lớp do mình tạo.

| Biến | Giá trị |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | URL HTTPS của project |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key hoặc legacy anon key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key hoặc legacy service_role, chỉ đặt trên máy chủ |
| `LLM_BASE_URL` | Endpoint OpenAI-compatible của 9Router, gồm đuôi `/v1` |
| `LLM_API_KEY` | API key ứng dụng được cấp tại 9Router |
| `MODEL_FAST` | Danh sách model/combo cho luyện tập và hội thoại |
| `MODEL_SMART` | Danh sách cho hỏi đáp theo tài liệu, hỗ trợ trả JSON |
| `MODEL_VISION` | Danh sách model/combo nhận ảnh, để trống để dùng OCR |

Các client trình duyệt và máy chủ dùng cookie qua `@supabase/ssr`. RLS và policy của Storage kiểm soát dữ liệu theo lớp. [Tài liệu Supabase SSR](https://supabase.com/docs/guides/auth/server-side/creating-a-client)

## 3. Chạy 9Router với model miễn phí

Mở một terminal riêng trên máy chạy model router.

```sh
npm install -g 9router
9router
```

1. Mở [dashboard 9Router](http://localhost:20128). Trong **Providers**, kết nối nhà cung cấp có hạn mức miễn phí của bạn và thử model trong dashboard.
2. Trong **Combos**, tạo `lingua-fast` cho phản hồi nhanh, `lingua-smart` cho câu trả lời JSON và `lingua-vision` nếu bạn có model nhận ảnh. Chỉ đưa model thuộc gói miễn phí vào danh sách. Có thể điền trực tiếp ID mà dashboard hiển thị thay cho tên combo.
3. Tạo API key cho ứng dụng tại 9Router. Điền key vào `LLM_API_KEY`. Giữ `LLM_BASE_URL=http://localhost:20128/v1` khi chạy Next.js và 9Router trên cùng máy.
4. Phân cách các combo bằng dấu phẩy, ví dụ `MODEL_SMART=lingua-smart,lingua-fast`. Khi gặp HTTP 429 hoặc 503, ứng dụng thử mục tiếp theo. Nếu toàn bộ model vision hết lượt, trình duyệt dùng Tesseract để đọc chữ trong ảnh rồi gửi phần chữ cho gia sư.

9Router dùng thông tin kết nối do bạn cấu hình. Hạn mức và model miễn phí thay đổi theo nhà cung cấp. [Hướng dẫn 9Router](https://github.com/decolua/9router)

## 4. Thử một vòng học

1. **Giáo viên** tạo lớp và Aim, ví dụ hoàn thành hai bài nghe và đạt ít nhất 70/100 ở một bài kiểm tra. Tải lên DOCX hoặc PDF có lớp văn bản, tối đa 4 MiB mỗi tệp. Đề kiểm tra hỗ trợ trắc nghiệm, trả lời ngắn và tự luận.
2. **Sinh viên** mở liên kết mời hoặc nhập mã sáu ký tự. Trang sinh viên hỗ trợ quét QR bằng camera hoặc ảnh. Ghi kế hoạch tuần rồi thử hỏi gia sư bằng một cụm từ xuất hiện trong tài liệu. Mỗi phần trả lời kiến thức có nhãn dạng `[Nguồn: bai-hoc.pdf - Đoạn 2]`.
3. Vào **Luyện tập** để nghe, hội thoại hoặc viết. Micro và camera cần localhost hoặc HTTPS cùng quyền truy cập thiết bị. Khả năng nhận giọng nói và giọng đọc phụ thuộc trình duyệt. OCR tải dữ liệu ngôn ngữ về trình duyệt ở lần dùng đầu.
4. Làm bài kiểm tra rồi xem điểm. Câu khách quan được chấm bằng khóa đáp án. Bài có tự luận chờ giáo viên duyệt điểm cuối. Quay lại trang tuần học để ghi điều làm tốt, điểm cần cải thiện và việc sẽ làm tuần tới.
5. Giáo viên xem tiến độ từng sinh viên và xử lý câu hỏi trong hộp thư. Các chỉ tiêu Aim lấy dữ liệu trong khoảng ngày theo múi giờ Việt Nam. Mỗi chỉ tiêu có trọng số bằng nhau và dừng ở 100%. Chỉ bài đã chấm đạt ngưỡng mới được tính vào số bài đạt.

**Dữ liệu mẫu.** Điền `SEED_TEACHER_EMAIL` và `SEED_TEACHER_PASSWORD` của một tài khoản giáo viên đã xác nhận trong `.env.local`, rồi chạy `npm run seed`. Script tạo lớp **English Café**, một Aim và một tài liệu hội thoại, sau đó in mã tham gia. Chạy lại với cùng tài khoản sẽ dùng lại bộ dữ liệu đó.

## 5. Đưa ứng dụng lên Vercel và nối tới máy cá nhân

1. Import repository vào Vercel, chọn preset **Next.js** và một phiên bản Node.js từ 22 trở lên. Thêm các biến Supabase và model trong **Settings → Environment Variables**. Chọn Hobby nếu dự án thuộc phạm vi sử dụng của gói.
2. Trên máy cá nhân, đặt mật khẩu quản trị riêng cho dashboard 9Router và bật yêu cầu API key (`REQUIRE_API_KEY=true`). Kiểm tra rằng truy cập `/v1/models` thiếu khóa bị từ chối trước khi mở tunnel. Cài `cloudflared` rồi chạy lệnh sau trong một terminal riêng.

   ```sh
   cloudflared tunnel --url http://localhost:20128
   ```

3. Lấy URL HTTPS do terminal in ra. Ví dụ nếu URL là `https://example.trycloudflare.com`, đặt **LLM_BASE_URL** trên Vercel thành `https://example.trycloudflare.com/v1`. Đặt **LLM_API_KEY** đúng bằng khóa đã cấp cho ứng dụng. Redeploy để áp dụng biến môi trường.
4. Trong Supabase Auth, dùng URL HTTPS của web làm **Site URL** và thêm `https://<ten-web>.vercel.app/auth/callback**` vào danh sách redirect. Giữ cả 9Router và cloudflared chạy trong thời gian cần dùng AI.

Quick Tunnel phù hợp cho buổi thử. Địa chỉ có thể đổi khi khởi động lại, lúc đó cần cập nhật Vercel. Cloudflare cấp URL cho toàn bộ dịch vụ trên cổng 20128, kể cả dashboard. Với địa chỉ ổn định, dùng named tunnel và cấu hình ingress chỉ cho các đường dẫn API cần thiết. [Cloudflare Quick Tunnels](https://developers.cloudflare.com/tunnel/get-started/quick-tunnels/)

Có thể vận hành trong hạn mức miễn phí của Supabase, Vercel và nhà cung cấp model đã chọn. Khi hết hạn mức, ứng dụng báo lỗi hoặc chuyển sang model miễn phí tiếp theo. [Supabase Free](https://supabase.com/docs/guides/platform/billing-on-supabase) · [Vercel Hobby](https://vercel.com/docs/plans/hobby)

## 6. Kiểm tra và khắc phục

```sh
npm run typecheck
npm run build
npm start
```

- `GET /api/health` trả `{"status":"ok","service":"LinguaCompanion"}` khi máy chủ Next.js đang chạy. Để thử kết nối đầu cuối, đăng nhập, mở lớp có tài liệu rồi gửi một câu hỏi.
- **Thiếu hồ sơ sau đăng ký.** Kiểm tra SQL Editor đã báo thành công và tài khoản đã xác nhận email. Schema cũng khởi tạo hồ sơ cho người dùng có sẵn khi cài lần đầu.
- **Gia sư chưa tìm được nguồn.** Thử cụm từ xuất hiện trong tài liệu đúng lớp. Tệp PDF chỉ chứa ảnh cần chuyển sang PDF có thể chọn văn bản hoặc DOCX trước khi tải.
- **Router không phản hồi.** Kiểm tra endpoint có đuôi `/v1`, khóa API và tên combo đúng trên dashboard. Nếu dùng tunnel, kiểm tra URL hiện tại sau mỗi lần khởi động lại.

Xem [AGENTS.md](AGENTS.md) để biết danh mục bảng, quy ước và các nguyên tắc kiểm chứng khi phát triển tiếp.
