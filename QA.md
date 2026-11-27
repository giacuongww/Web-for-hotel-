# Kiểm thử Hoa Phủ Hotel V1

| Nhóm | Kết quả xác minh |
| --- | --- |
| Mã nguồn | ESLint, TypeScript và Vite production build chạy thành công. Vite báo cảnh báo về các chỉ thị `use client` trong thư viện khi bundle cho SPA, build vẫn hoàn tất. |
| Giao diện | Playwright kiểm tra trang chủ, danh sách phòng, chi tiết phòng, đặt phòng, giới thiệu, dịch vụ và liên hệ ở 320, 375, 390, 768, 1024, 1440 và 1920 px bằng cả tiếng Việt và Trung giản thể. Kịch bản không phát hiện tràn ngang hoặc lỗi JavaScript. |
| Phòng và ảnh | Kiểm tra 7 loại phòng, 14 giá, số giường, sức chứa thực tế, không hiển thị diện tích. Hai Suite có cùng giá và dùng ảnh riêng. Kiểm tra nguồn ảnh trong 7 trang chi tiết, đổi ảnh, mở ảnh lớn, chuyển ảnh và đóng bằng Escape. |
| Tìm và lọc | Kiểm tra 3 khách / 1 phòng và 4 khách / 2 phòng, truyền ngày và số lượng đến booking, lọc loại phòng, sức chứa, giá, ăn sáng, sắp xếp, xóa bộ lọc và trạng thái không có kết quả. |
| Đặt phòng | Kiểm tra ngày trả không hợp lệ, sức chứa, điện thoại, email, bước xem lại, chỉnh sửa giữ dữ liệu, đổi ngôn ngữ khi đang nhập, sao chép mã và dữ liệu LocalStorage tối thiểu. Standard Double, 3 đêm, 2 phòng, có ăn sáng cho tổng 4.380.000 VNĐ. |
| Liên hệ | Kiểm tra đích của các liên kết gọi, email, Zalo và chỉ đường, cùng lỗi form và bản nháp email hợp lệ. Kiểm thử không gọi/gửi thực tế. |
| Định tuyến | Kiểm tra truy cập trực tiếp và tải lại trang theo hash, 404 cho mã phòng không tồn tại và tùy chọn ngôn ngữ được giữ qua tải lại. |

Chưa xác minh logo, bảng ánh xạ mã ảnh của ZIP WebP gốc, URL Facebook hoặc tọa độ ghim. Sitemap đa trang cần URL triển khai chính thức dạng crawlable. Trạng thái xác nhận và thông tin khách trong phiên không được khôi phục sau khi tải lại trang. Phiên bản này chưa gửi yêu cầu đặt phòng đến khách sạn, giữ tồn phòng hay thanh toán.
