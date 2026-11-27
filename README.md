# Web-for-hotel-
## Trang chủ Hoa Phủ Hotel

```sh
npm ci
npm run dev
npm run build
npm run preview
```

Biểu mẫu tìm phòng chạy thử trên trình duyệt. Bản V1 chưa kết nối dữ liệu phòng trống hoặc hệ thống đặt phòng.

## V1 song ngữ

- `npm run lint` kiểm tra mã nguồn. `npm run build` kiểm tra TypeScript và tạo bản tĩnh trong `dist/`.
- React Router dùng đường dẫn dạng hash để các trang hoạt động khi mở trực tiếp hoặc tải lại trên máy chủ tĩnh. Có thể build cho thư mục con bằng `npm run build -- --base=./`.
- Tiếng Việt mặc định. Bộ chuyển VI / 中文 giữ nguyên dữ liệu form đang nhập và lưu tùy chọn trên trình duyệt.
- Luồng đặt phòng chỉ mô phỏng. LocalStorage lưu mã, loại phòng, ngày, gói, số khách, số phòng và tổng tiền của lần xác nhận gần nhất. Tên, điện thoại, email và ghi chú chỉ có trong bộ nhớ của trang đang mở.
- Liên hệ qua email tạo bản nháp trong ứng dụng email của khách. Chỉ đường dùng địa chỉ được cung cấp. Facebook hiển thị tên trang khi chưa có URL.
- Bản hiện tại có 43 ảnh phòng và 6 ảnh mặt tiền/sảnh/dịch vụ, thêm một kích thước riêng cho ảnh hero trên mobile. Ảnh được xuất lại từ các thư mục ảnh thật, chưa thể đối chiếu với ZIP WebP đã tuyển chọn. Logo gốc và favicon theo logo đang chờ file nguồn.
- Dùng `git diff --name-status df236f0..HEAD` để xem danh sách tệp thay đổi so với bản trang chủ đầu tiên.
- [Báo cáo kiểm thử](QA.md)
