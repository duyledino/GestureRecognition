# BÁO CÁO DỰ ÁN: HỆ THỐNG MUA SẮM ĐIỀU KHIỂN BẰNG CỬ CHỈ TAY

## 1. Mô tả ứng dụng (Demo)
`GestureStore` là một ứng dụng web demo cho phép người dùng điều hướng và tương tác với trang mua sắm chỉ bằng cử chỉ tay trước webcam. Dự án hướng đến một trải nghiệm thương mại điện tử mang tính tương lai, trong đó các thao tác cuộn, chọn sản phẩm và mở trang chi tiết được thay thế bằng nhận diện cử chỉ thời gian thực.

**Các tính năng chính của ứng dụng bao gồm:**
* **Hiển thị danh sách sản phẩm:** Trang chủ lấy dữ liệu sản phẩm từ cơ sở dữ liệu SQLite và hiển thị theo dạng lưới hiện đại.
* **Điều khiển bằng cử chỉ tay thời gian thực:** Người dùng mở camera, đưa tay vào khung hình và sử dụng các cử chỉ để điều hướng trang.
* **Chọn sản phẩm bằng cử chỉ:** Khi phát hiện cử chỉ phù hợp, hệ thống tự động tô sáng sản phẩm đang được chọn và có thể chuyển sang trang chi tiết.
* **Trang chi tiết sản phẩm:** Mỗi sản phẩm có trang riêng với thông tin mô tả, giá bán và nút thao tác mua hàng minh họa.
* **Giao diện hiện đại:** Thiết kế dark mode, glassmorphism, hiệu ứng hover và animation mượt để tạo cảm giác cao cấp.

**Các cử chỉ được hỗ trợ trong hệ thống:**
* **Index Up:** Cuộn lên trên.
* **Index Down:** Cuộn xuống dưới.
* **Pinch:** Chọn sản phẩm kế tiếp trong danh sách.
* **Trident:** Mở trang chi tiết của sản phẩm đang được chọn.
* **Palm:** Dừng cuộn và giữ trạng thái hiện tại.
* **Fist:** Dừng thao tác, tương tự trạng thái nghỉ.

Ứng dụng được xây dựng theo mô hình web hiện đại với backend Python, giao tiếp thời gian thực qua WebSocket và phần xử lý cử chỉ diễn ra trực tiếp trên trình duyệt kết hợp với MediaPipe.

---

## 2. Mô tả về bài toán AI (T, P, E)
Dựa trên yêu cầu của hệ thống nhận diện cử chỉ tay, bài toán học máy được xác định theo bộ ba tham số (T, P, E) như sau:

* **T (Task - Nhiệm vụ):** Nhận diện cử chỉ tay từ dữ liệu camera và phân loại thành các trạng thái điều khiển giao diện như `index_up`, `index_down`, `pinch`, `trident`, `palm`, `fist` hoặc `none`.
* **P (Performance - Hiệu năng):** Độ chính xác của việc phân loại cử chỉ trong thời gian thực, đồng thời đảm bảo độ trễ thấp để người dùng có thể điều khiển giao diện một cách tự nhiên.
* **E (Experience - Dữ liệu/Trải nghiệm huấn luyện):** Tập dữ liệu hình ảnh hoặc video bàn tay thu từ webcam, được biểu diễn dưới dạng landmark 21 điểm của MediaPipe Hand Landmarker. Mỗi khung hình là một mẫu đầu vào giúp hệ thống suy ra tư thế bàn tay tương ứng.

Trong bài toán này, mô hình không chỉ cần “đúng” mà còn phải “nhanh” và “ổn định”, vì người dùng tương tác liên tục theo thời gian thực. Do đó, trải nghiệm tốt của hệ thống phụ thuộc mạnh vào khả năng phát hiện cử chỉ ổn định, ít nhiễu và phản hồi gần như tức thì.

---

## 3. Con AI được sử dụng trong hệ thống
Hệ thống sử dụng **MediaPipe Hand Landmarker** để phát hiện và theo dõi bàn tay. Đây là một giải pháp AI thị giác máy tính mạnh mẽ, cho phép xác định vị trí các khớp tay quan trọng trong khung hình chỉ trong vài mili giây.

### 3.1. Cấu trúc 21 điểm landmark của bàn tay
MediaPipe biểu diễn một bàn tay bằng 21 điểm mốc tiêu chuẩn. Các điểm này không phải là ảnh thô mà là tọa độ chuẩn hóa trong không gian ảnh, với giá trị `x`, `y`, `z`:

* **0 - Wrist:** cổ tay, điểm gốc của toàn bộ bàn tay.
* **1 - 4:** ngón cái, từ gốc đến đầu ngón.
* **5 - 8:** ngón trỏ.
* **9 - 12:** ngón giữa.
* **13 - 16:** ngón áp út.
* **17 - 20:** ngón út.

Trong hệ tọa độ này:
* `x` và `y` thường nằm trong khoảng từ 0 đến 1 nếu điểm ở trong khung hình.
* `y` càng nhỏ thì điểm càng nằm cao hơn trên ảnh.
* `z` thể hiện độ sâu tương đối của điểm so với camera.

Nhờ biểu diễn này, hệ thống không cần nhận diện toàn bộ hình bàn tay theo pixel mà chỉ cần đọc các mốc hình học then chốt để suy luận tư thế tay.

### 3.2. Cơ chế suy luận cử chỉ từ landmark
Ứng dụng không dùng mô hình phân loại học sâu riêng cho từng cử chỉ, mà dùng **logic hình học trên landmark**:

* **Trạng thái ngón tay:** so sánh vị trí đầu ngón (`tip`) với khớp giữa gần đầu ngón (`pip`).
* **Ngón duỗi lên:** nếu `tip.y < pip.y`, ngón tay được xem là đang duỗi lên.
* **Ngón gập xuống:** nếu `tip.y > pip.y`, ngón tay được xem là đang co lại.
* **Pinch:** tính khoảng cách Euclid giữa đầu ngón cái và đầu ngón trỏ. Nếu khoảng cách nhỏ hơn một ngưỡng, hệ thống coi đó là hành động chụm tay.

Quy tắc này giúp hệ thống phản hồi nhanh, nhẹ và phù hợp với bài toán điều khiển giao diện theo thời gian thực.

### 3.3. Mapping cử chỉ trong hệ thống
Từ các landmark, ứng dụng phân loại ra các cử chỉ sau:

* `palm`: cả bốn ngón chính đều duỗi lên.
* `fist`: cả bốn ngón chính đều co xuống.
* `index_up`: chỉ ngón trỏ duỗi lên.
* `index_down`: ngón trỏ duỗi theo hướng xuống.
* `pinch`: ngón cái và ngón trỏ chụm gần nhau.
* `trident`: ngón trỏ, giữa, áp út duỗi lên, còn ngón út co xuống.

Trong phần xử lý phía frontend, MediaPipe được tải trực tiếp từ CDN và chạy ở chế độ video để nhận diện liên tục. Ở phía backend, `app/gestures.py` cũng có một bộ nhận diện dùng MediaPipe Hand Landmarker để xử lý khung hình mã hóa base64 gửi qua WebSocket. Điều này cho thấy hệ thống có thể mở rộng theo cả hai hướng: xử lý trực tiếp trên trình duyệt hoặc đồng bộ dữ liệu với server.

---

## 4. Cách thức tích hợp AI vào ứng dụng
Quá trình tích hợp AI vào `GestureStore` là sự kết hợp giữa frontend, backend và cơ sở dữ liệu, nhằm biến tín hiệu camera thành hành động điều hướng thực tế trên website.

### 4.1. Quy trình xử lý dữ liệu
Để hệ thống hiểu được cử chỉ tay của người dùng, dữ liệu đi qua các bước chính sau:

1. **Thu nhận hình ảnh từ webcam:**
   * Trình duyệt xin quyền truy cập camera và hiển thị luồng video ở góc màn hình.
   * Ảnh webcam được xử lý ngay trên frontend để giảm độ trễ.

2. **Nhận diện landmark bằng MediaPipe:**
   * Mô hình Hand Landmarker phân tích khung hình và trả về 21 điểm mốc của bàn tay.
   * Các điểm này được dùng để vẽ skeleton tay trên canvas và làm đầu vào cho bộ phân loại cử chỉ.
   * Trên frontend, đoạn mã trong `app/static/js/main.js` gọi `detectForVideo()` trên từng khung hình để lấy landmark mới nhất.

3. **Chuẩn hóa dữ liệu landmark:**
   * Mỗi landmark được giữ dưới dạng `x`, `y`, `z` đã chuẩn hóa, nên có thể so sánh tương đối giữa các ngón tay mà không cần biết kích thước bàn tay thật.
   * Ứng dụng dùng các landmark mốc cố định như `4`, `6`, `8`, `10`, `12`, `14`, `16`, `18`, `20` để xác định vị trí đầu ngón và khớp giữa.
   * Đây là điểm mấu chốt giúp logic nhận diện có thể hoạt động ổn định dù camera ở khoảng cách khác nhau.

4. **Phân loại cử chỉ bằng luật logic:**
   * Hệ thống kiểm tra khoảng cách giữa các điểm và trạng thái duỗi của từng ngón.
   * Ví dụ:
     * Nếu tất cả ngón đều hướng lên, nhận dạng là `palm`.
     * Nếu tất cả ngón đều co lại, nhận dạng là `fist`.
     * Nếu chỉ ngón trỏ duỗi lên, nhận dạng là `index_up`.
     * Nếu ngón cái và ngón trỏ chụm gần nhau, nhận dạng là `pinch`.
     * Nếu ngón trỏ, giữa, áp út duỗi còn ngón út co, nhận dạng là `trident`.

5. **Gắn cử chỉ với hành động giao diện:**
   * Cử chỉ được đưa vào một vòng lặp điều khiển liên tục.
   * Khi cử chỉ thay đổi và ổn định đủ số khung hình, hệ thống mới thực thi hành động như cuộn trang hoặc chuyển sản phẩm.
   * Cách làm này giúp giảm nhiễu do rung tay hoặc phát hiện nhầm trong một khung hình lẻ.

### 4.2. Cơ chế điều khiển giao diện
Sau khi cử chỉ được nhận diện, hệ thống biến nó thành hành động cụ thể:

* **`index_up`**: Gọi `window.scrollBy()` để cuộn lên.
* **`index_down`**: Cuộn xuống.
* **`pinch`**: Chuyển sang sản phẩm tiếp theo và tô sáng sản phẩm đó.
* **`trident`**: Kích hoạt điều hướng sang trang chi tiết của sản phẩm đang được chọn.
* **`palm` / `fist`**: Dừng cuộn và giữ trạng thái hiện tại.

### 4.3. Cách triển khai trong code
Phần triển khai thực tế của dự án có thể chia thành ba lớp rõ ràng:

* **Lớp nhận diện tay:** `app/static/js/main.js` tải MediaPipe, lấy webcam stream, gọi bộ nhận diện theo từng frame và nhận danh sách landmark.
* **Lớp suy luận cử chỉ:** Hàm nhận diện kiểm tra quan hệ giữa các landmark để quyết định cử chỉ. Ví dụ:
  * `tip.y < pip.y` nghĩa là ngón đang duỗi lên.
  * Khoảng cách giữa `landmarks[4]` và `landmarks[8]` nhỏ hơn ngưỡng thì là `pinch`.
  * Chuỗi điều kiện được sắp xếp theo độ ưu tiên để tránh mâu thuẫn giữa các cử chỉ.
* **Lớp hành vi giao diện:** Sau khi có cử chỉ, ứng dụng thay đổi trạng thái cuộn, tô sáng sản phẩm, hoặc điều hướng sang trang chi tiết.

Ở phía backend, `app/gestures.py` thực hiện cùng một ý tưởng nhưng theo hướng server-side:
* Ảnh base64 từ client được giải mã thành mảng ảnh.
* Ảnh được đổi sang RGB để phù hợp với MediaPipe.
* Model Hand Landmarker trả về landmark.
* Backend sau đó gửi lại cử chỉ và tọa độ landmark cho frontend qua WebSocket.

### 4.4. Tích hợp với backend và cơ sở dữ liệu
Phần backend được xây dựng bằng **FastAPI** và **SQLAlchemy**:
* Khi ứng dụng khởi động, bảng dữ liệu được tạo tự động từ model `Product`.
* Nếu cơ sở dữ liệu chưa có sản phẩm, hệ thống sẽ chèn sẵn dữ liệu mẫu để demo.
* Trang chủ truy vấn danh sách sản phẩm từ SQLite và render bằng Jinja2.
* Endpoint WebSocket tại `/ws/gestures` cho phép truyền khung hình cử chỉ theo thời gian thực nếu cần mở rộng thêm các tính năng đồng bộ với server.

Nhờ kiến trúc này, ứng dụng vừa có tính tương tác trực tiếp trên trình duyệt, vừa dễ mở rộng sang các kịch bản phức tạp hơn như thống kê hành vi người dùng hoặc đồng bộ trạng thái mua sắm.

---

## 5. Hình ảnh Demo ứng dụng

**(Dưới đây là các vị trí chèn hình ảnh minh họa cho báo cáo)**

### Hình 1: Giao diện trang chủ
*Mô tả: Trang chủ hiển thị danh sách sản phẩm theo dạng lưới, kèm overlay webcam và trạng thái cử chỉ ở góc màn hình.*
![Trang chủ GestureStore](placeholder_home_image)

### Hình 2: Giao diện điều khiển bằng cử chỉ tay
*Mô tả: Người dùng đưa tay trước camera, hệ thống vẽ khung xương bàn tay và cập nhật cử chỉ nhận diện theo thời gian thực.*
![Điều khiển bằng cử chỉ](placeholder_gesture_image)

### Hình 3: Trang chi tiết sản phẩm
*Mô tả: Trang chi tiết của một sản phẩm sau khi được chọn bằng cử chỉ `trident` hoặc thao tác điều hướng tương đương.*
![Chi tiết sản phẩm](placeholder_product_image)

---

## 6. Kết luận
Dự án `GestureStore` đã xây dựng thành công một nguyên mẫu mua sắm trực tuyến điều khiển bằng cử chỉ tay, kết hợp giữa giao diện web hiện đại và nhận diện bàn tay thời gian thực. Việc ứng dụng MediaPipe giúp hệ thống có khả năng nhận diện nhanh, chính xác và phù hợp với trải nghiệm tương tác tự nhiên.

Điểm mạnh của dự án là:
* Điều hướng không cần chuột hay bàn phím.
* Phản hồi trực tiếp ngay trên trình duyệt.
* Giao diện đẹp, dễ dùng và có tính trình diễn cao.
* Kiến trúc rõ ràng giữa frontend, backend và cơ sở dữ liệu.

Báo cáo này trình bày từ mô tả ứng dụng, bài toán AI theo mô hình T, P, E cho đến quy trình tích hợp vào hệ thống. Đây là nền tảng tốt để tiếp tục phát triển các tính năng nâng cao hơn như nhận diện nhiều người dùng, cá nhân hóa điều khiển, giỏ hàng bằng cử chỉ hoặc tích hợp thêm các mô hình AI khác trong tương lai.
