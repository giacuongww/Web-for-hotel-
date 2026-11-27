# Đối chiếu hành vi Maia và Hoa Phủ

| Hành vi nguồn | Trang | Quan sát | Hoa Phủ | Trạng thái và kiểm thử | Hạn chế |
| --- | --- | --- | --- | --- | --- |
| Header cố định và hero phủ ngang | Trang chủ | Desktop trước và sau khi cuộn | Hero ảnh thật, tiêu đề serif, header chuyển nền lúc cuộn | Đã triển khai; kiểm tra viewport công khai | Bố cục và nhận diện Hoa Phủ riêng |
| Menu sản phẩm | Header | Hai đường dẫn con trong DOM | Dropdown 7 phòng, đóng bằng Escape | Đã triển khai, kiểm tra menu Hoa Phủ | Chưa xác nhận trigger menu con Maia |
| Tìm kiếm | Header | Lightbox hiện trường tìm kiếm | Modal tìm kiếm nhóm phòng, tiện ích, tin và liên hệ | Đã kiểm tra truy vấn và mở kết quả | Tìm trong nội dung website Hoa Phủ |
| Hamburger | Mobile | Nút menu ở 390 px | Menu thu gọn, thao tác bàn phím và cảm ứng | Đã kiểm tra | Không sao chép panel nguồn |
| Ảnh và khối nội dung dài | Giới thiệu, Vị trí, Tiện ích | Các section ảnh lớn | Ảnh thật, tabs tiện ích, Google Maps theo địa chỉ | Đã kiểm tra tabs và responsive | Chưa xác minh pin chính thức |
| Danh mục và chi tiết | Sản phẩm | Phân nhóm sản phẩm dự án | Danh mục 7 phòng, gói giá, bộ lọc và gallery | Đã kiểm tra lọc sức chứa | Không dùng mặt bằng hoặc nội dung bất động sản |
| Tin tức | Tin tức | Danh sách bài | Danh sách/chi tiết CMS, tìm kiếm tiếng Việt và Trung | Đã kiểm tra trạng thái công khai khi chưa có bài | Chưa có nội dung đã duyệt; chưa làm taxonomy/phân trang |
| Form | Trang chủ, Liên hệ | Có giao diện tư vấn; không gửi form nguồn | Form liên hệ và yêu cầu đặt phòng | Kiểm tra SQL cho ghi dữ liệu; thử demo trình duyệt | Không nhận đơn thật trên preview chưa có Supabase |
| Tiện ích nổi | Header/footer | Liên kết VR360, nút chia sẻ | Hotline và Zalo dùng thông tin đã cung cấp | Đã triển khai | VR360 chờ tệp Hoa Phủ |
| Gallery | Hoa Phủ | Chưa xác minh parity từ Maia | Gallery riêng, lọc, ảnh phóng lớn, phím và swipe | Đã kiểm tra lọc/lightbox trên trình duyệt | Swipe triển khai nhưng chưa kiểm tra trên máy thật |

## Chạy và triển khai thử

Chạy `npm ci`, `npm run dev` hoặc `npm run build && npm run preview`. Preview dùng router hash (ví dụ `/#/rooms`); triển khai cần fallback SPA cho truy cập path trực tiếp. Các đường dẫn tiếng Việt cũ còn hoạt động. Kết nối Supabase theo [V2.md](V2.md) và áp dụng toàn bộ migration mới trên staging. Không dùng hướng dẫn bật tồn phòng của V2 cũ: website hiện chỉ tạo yêu cầu, không giữ phòng và không tạo đơn chính thức.

1. Khách xem giá dự kiến và gửi yêu cầu nếu Supabase đã được cấu hình.
2. Nhân viên xem Yêu cầu đặt phòng, kiểm tra và tạo booking chính thức trên ezCloud.
3. Nhập mã ezCloud vào website trước khi đánh dấu đã xác nhận.
4. Chế độ ezBe và ezCloud API chưa có adapter hoạt động; cần thông tin tích hợp được xác nhận.

Kiểm thử bằng `npm test`, `npm run lint`, `npm run build`. Test database dùng PostgreSQL nhúng với dữ liệu thử tách biệt, bao gồm tính lại giá, idempotency, bảo vệ PII, không tạo phân bổ và yêu cầu mã ezCloud. Không có kiểm thử tích hợp với ezCloud hoặc Supabase production. Số lượt xem/click website là tín hiệu trình duyệt tổng hợp, không đại diện cho khách duy nhất, doanh thu hay độ lấp đầy.

Chưa có chính sách bảo mật được duyệt, Place ID, logo gốc, bộ ZIP 61 ảnh, văn bản tin tức hoặc quyền API ezCloud. Bản hiện tại giữ bộ ảnh thật và wordmark. CMS chưa điều khiển mọi khối trang chủ, taxonomy tin, SEO canonical/sitemap theo domain và toàn bộ nội dung cố định. Khung admin cũ và migration lịch sử còn trong source, nhưng chế độ website đã chuyển sang tiếp nhận yêu cầu, không chạy PMS song song. Chưa đồng bộ Figma.
