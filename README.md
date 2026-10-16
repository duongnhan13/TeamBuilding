# 🎪 WEB TRÒ CHƠI TEAM BUILDING PHÒNG KẾ TOÁN - BVĐK PHƯƠNG ĐÔNG 2026

Hệ thống web trò chơi tương tác thời gian thực (Real-time Multiplayer Game Show) được xây dựng theo đúng nội dung file Excel **`Team Building TCKT.xlsx`**, thiết kế tối ưu và linh hoạt cho **40+ người chơi** cùng tham gia bằng điện thoại thông minh kết hợp với màn hình máy chiếu của ban tổ chức (MC / Host).

---

## 🌟 TÍNH NĂNG NỔI BẬT

1. **Chuẩn 2 Bộ Trò Chơi từ File Excel**:
   - 🎭 **Bộ 1: Squizz - Bóc Phốt & Bình Chọn Nội Bộ (10 câu hỏi)**:
     - Ai là "Thần giữ cửa Phương Đông", "Não cá vàng chấm công", "Khách VIP shipper", "Kẻ hủy diệt pin", "Tốc độ ánh sáng 17h30", v.v.
     - Người chơi bình chọn tên đồng nghiệp trên điện thoại (có sẵn danh sách gợi ý 1 chạm).
     - Màn hình máy chiếu hiển thị biểu đồ vote thời gian thực, bảng vinh danh người bị gọi tên nhiều nhất kèm **kịch bản lời xướng MC hài hước** và hình phạt cạn chén rượu danh dự!
     - Nút **"100% CẠN CHÉN! (ZÔ ZÔ!)"** kích hoạt pháo hoa và hiệu ứng cụng ly trên điện thoại của tất cả mọi người.
   - 🧠 **Bộ 2: Bộ Q&A - Đấu Trí & Đố Vui Hại Não (15 câu hỏi)**:
     - **5 câu Lịch sử Việt Nam**: Trắc nghiệm 4 đáp án (Bạch Đằng - Ngô Quyền, Chiến dịch Hồ Chí Minh, Trần Quốc Toản, Điện Biên Phủ 56 ngày đêm, Nữ tướng Nguyễn Thị Định).
     - **10 câu Đố vui thông minh**: Ăn gì nhanh nhất, Cây gì gọi bằng mẹ, Nước càng rửa càng bẩn, Đầu chuột đuôi heo, Đồi không trồng cây, Bỏ ngoài nướng trong ăn ngoài bỏ trong, v.v.
     - Trả lời trắc nghiệm 4 màu phong cách Kahoot, đồng hồ đếm ngược 20s kịch tính, tính điểm theo tốc độ và độ chính xác, biểu đồ thống kê đáp án và Bảng xếp hạng Top 10.
     - **Màn hình Trao giải Podium (Hạng 1, 2, 3)** với cúp vàng, vương miện và nhạc chiến thắng.

2. **Linh hoạt cho 40+ người chơi**:
   - Chạy trên nền tảng **Node.js + Express + Socket.IO** siêu nhẹ, độ trễ gần như bằng 0.
   - Giao diện người chơi trên điện thoại mượt mà, tự động nhớ phiên đăng nhập (không lo bị văng khi khóa màn hình).
   - Tự động sinh mã **QR Code** to rõ trên màn hình máy chiếu để 40 người quét vào sảnh chỉ trong 10 giây.
   - Hoạt động **100% Offline** trong mạng Wi-Fi nội bộ hoặc điểm phát di động (Hotspot), không phụ thuộc vào Internet chập chờn khi đi du lịch / nhà hàng / resort.
   - Tích hợp sẵn bộ âm thanh (Web Audio API) sống động: nhạc đếm ngược, tiếng chuông trả lời đúng/sai, tiếng vỗ tay, tiếng cụng ly zô zô mà không cần tải file MP3 ngoài.

---

## 🚀 HƯỚNG DẪN SỬ DỤNG NHANH

### Cách 1: Chạy bằng 1 click chuột (Khuyên dùng)
- Nhấp đúp chuột vào file **`chay_game.bat`** trong thư mục này.
- Cửa sổ màu đen sẽ hiện lên địa chỉ IP mạng nội bộ và cổng (mặc định đã cấu hình cổng **`3999`** để tránh các cổng đang bận của máy).

### Cách 2: Chạy bằng dòng lệnh
Mở Terminal / PowerShell trong thư mục dự án và chạy:
```bash
node server.js 3999
```
*(Bạn có thể đổi số 3999 thành bất kỳ số cổng nào bạn muốn, ví dụ: `node server.js 8999`).*

---

## 📱 CÁCH KẾT NỐI VÀ TRÌNH CHIẾU

1. **Đối với Máy tính / Laptop của Ban tổ chức (MC / Host)**:
   - Kết nối máy tính vào mạng Wi-Fi chung của phòng hoặc phát Wi-Fi từ điện thoại/laptop.
   - Cắm dây HDMI vào Máy chiếu hoặc TV lớn.
   - Mở trình duyệt web (Chrome / Cốc Cốc / Edge) và truy cập:
     ```
     http://localhost:3999/host.html
     ```
   - Nhấn nút **Toàn màn hình (⛶)** hoặc phím **F11** để giao diện hiển thị chuyên nghiệp như một Gameshow truyền hình.

2. **Đối với 40+ Người chơi (Sử dụng Điện thoại thông minh)**:
   - Kết nối điện thoại vào **cùng mạng Wi-Fi** với máy tính Host.
   - Mở ứng dụng **Camera** hoặc **Zalo** quét mã QR to trên màn hình máy chiếu.
   - Hoặc gõ trực tiếp địa chỉ hiển thị trên máy chiếu (Ví dụ: `http://192.168.120.178:3999/player.html`).
   - Nhập tên của mình, chọn biểu tượng avatar yêu thích và bấm **"VÀO CHƠI NGAY"**.

---

## ⚙️ CẤU TRÚC DỮ LIỆU & TÙY BIẾN

Toàn bộ dữ liệu nằm trong thư mục `data/` rất dễ xem và chỉnh sửa:
- `data/squizz_questions.json`: 10 câu hỏi bình chọn bóc phốt, mục tiêu, kịch bản lời xướng MC.
- `data/qa_questions.json`: 15 câu hỏi Lịch sử & Đố vui với các đáp án, lời giải thích và thời gian đếm ngược.
- `data/members.json`: Danh sách nhân viên phòng để hiển thị gợi ý 1 chạm khi bình chọn (Bạn có thể sửa trực tiếp trong file này hoặc bấm nút **"⚙️ Cài Đặt"** trên góc màn hình MC).
