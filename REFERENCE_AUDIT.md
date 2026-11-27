# Khảo sát Maia Resort Ho Tram

Khảo sát ngày 27/11/2026 bằng Chromium và đối chiếu nội dung HTML. Cả bảy URL dưới đây trả HTTP 200. Kiểm tra homepage ở 1440 × 900 và 390 × 844, có cuộn trang và thao tác tìm kiếm. Không gửi form hay truy cập tài liệu dự án.

| Trang | Quan sát được | Áp dụng cho Hoa Phủ |
| --- | --- | --- |
| [Trang chủ](https://maiaresorthotram.com/) | Hero ảnh toàn chiều rộng, lớp tải logo trước khi hiện trang, header cố định top 0 trước và sau cuộn. Desktop dùng dải menu hai phía logo, mobile giảm số mục và có hamburger. Có liên kết ngôn ngữ, tìm kiếm, điều hướng sản phẩm và VR360. | Header đỏ sẫm/trắng theo vị trí cuộn, wordmark Hoa Phủ, ảnh mặt tiền, headline serif dưới bên trái, CTA yêu cầu đặt phòng. Dùng tìm kiếm modal và dropdown 7 loại phòng. |
| [Giới thiệu](https://maiaresorthotram.com/gioi-thieu/) | Các khối kể chuyện có ảnh, nội dung về dự án/đơn vị vận hành và phần tư vấn. Có thẻ video trong DOM. | Ảnh sảnh, mặt tiền, quy mô khách sạn và liên kết phòng. |
| [Vị trí](https://maiaresorthotram.com/vi-tri/) | Các khối ảnh, bản đồ dự án và nội dung kết nối vùng. | Ảnh Hoa Phủ, địa chỉ, Google Maps theo địa chỉ và chỉ đường. |
| [Sản phẩm](https://maiaresorthotram.com/san-pham/) | Ảnh sản phẩm, danh mục căn hộ và mặt bằng trong nội dung. Nav có hai đường dẫn con. Chưa xác nhận trigger tương tác đầy đủ của menu con. | Danh mục và bộ lọc 7 loại phòng, chi tiết ảnh, giá và CTA yêu cầu. |
| [Tiện ích](https://maiaresorthotram.com/tien-ich/) | Ảnh lớn, danh mục tiện ích đánh số và mảng nội dung dài. | Tabs chuyển ảnh/nội dung của nhà hàng, phòng họp, bãi xe và sảnh; các tiện nghi lưu trú trình bày bằng chữ. |
| [Tin tức](https://maiaresorthotram.com/tin-tuc-su-kien/) | Danh sách có ảnh, tiêu đề, ngày và phân loại. | Bài Hoa Phủ lấy từ CMS đã xuất bản; trạng thái trống khi chưa có bài. |
| [Liên hệ](https://maiaresorthotram.com/lien-he/) | Thông tin và form tư vấn, Google Maps iframe, footer có điều hướng và liên hệ. | Điện thoại/email/Zalo, bản đồ theo địa chỉ và form liên hệ Supabase. |

Tìm kiếm mở một trường search hiển thị trong lightbox. Đã xác định nút hamburger ở mobile và thao tác mở. Có nút nổi chia sẻ và VR360 trong bản chụp desktop. Chưa xác nhận bằng thao tác mọi slider, tab, popup, kích hoạt hover trên tất cả trang, kích thước tablet của nguồn, giá trị font cụ thể, parallax hay page transition. Các đặc điểm đó không được ghi nhận là parity. Ảnh chụp nguồn nằm ngoài repository và chỉ dùng đối chiếu.
