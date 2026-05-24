# Hệ thống Quản lý và Xác thực Văn bằng bằng Blockchain  
## Thuy Loi University

Hệ thống được phát triển dựa trên kiến trúc **Hybrid Storage**, kết hợp giữa **Hyperledger Fabric** (On-chain Storage) và **MongoDB Atlas** (Off-chain Storage) nhằm đảm bảo tính **bất biến**, **toàn vẹn** và **bảo mật** cho dữ liệu văn bằng đại học.

---

# Công nghệ sử dụng (Tech Stack)

| Thành phần | Công nghệ |
|---|---|
| Hệ điều hành máy chủ | Pop!_OS 24.04 LTS |
| Blockchain Framework | Hyperledger Fabric v2.5.15 |
| Database Off-chain | MongoDB Atlas |
| Runtime & SDK | Node.js v24.15.0 / Fabric Gateway |
| Web Framework | Next.js 16.2.4 (App Router) |

---

# Yêu cầu hệ thống trước khi cài đặt (Prerequisites)

Đảm bảo máy tính đã cài đặt sẵn:

- **Node.js** (khuyến nghị v24.x)
- **Docker & Docker Compose**
- **Git**
- **cURL**

---

# Hướng dẫn Cài đặt & Vận hành

## Bước 1: Clone mã nguồn và cài đặt thư viện

```bash
git clone https://github.com/gianglee25/blockchain-.git

cd blockchain-

npm install
```

---

## Bước 2: Khởi động mạng Blockchain (Fabric Network)

> Các file binaries của Hyperledger Fabric không được lưu trên GitHub để tối ưu dung lượng và bảo mật.

```bash
cd blockchain-network

# Xóa dữ liệu cũ (nếu có)
./network.sh down

# Khởi tạo mạng lưới và tạo channel
./network.sh up createChannel -c channel-vb-tlu -ca

# Deploy Smart Contract (Chaincode)
./network.sh deployCC \
  -ccn certificates \
  -ccp ../chaincode \
  -ccl javascript

cd ..
```

---

## Bước 3: Cấu hình biến môi trường

Tạo file `.env` tại thư mục gốc của dự án:

```env
# =========================
# MONGODB CONFIG
# =========================
MONGODB_URI=

# =========================
# NEXTAUTH CONFIG
# =========================
NEXTAUTH_SECRET=
NEXTAUTH_URL=

# =========================
# FABRIC CONFIG
# =========================
CHANNEL_NAME=
CHAINCODE_NAME=
MSP_ID=
```

---

## Bước 4: Khởi tạo Wallet định danh (Bắt buộc)

>Thư mục `wallet/` không được đưa lên GitHub vì chứa Private Key và chứng chỉ số.

Bạn cần tự tạo lại danh tính (Identity) trên máy cục bộ:

```bash
# Đăng ký tài khoản Admin
node src/lib/fabric/enrollAdmin.js

# Đăng ký User để thực hiện giao dịch
node src/lib/fabric/registerUser.js
```

### Sau khi thực hiện thành công:
- Thư mục `wallet/` sẽ được tạo
- Bên trong sẽ chứa các file `.id`

---

## Bước 5: Khởi chạy ứng dụng Web

```bash
npm run dev
```

Truy cập hệ thống tại:

```txt
http://localhost:3000
```

---

# Các chức năng nghiệp vụ cốt lõi

## Import dữ liệu sinh viên (Off-chain)

- Hỗ trợ upload file Excel danh sách sinh viên tốt nghiệp
- Tự động đồng bộ dữ liệu vào MongoDB Atlas

---

## ⛓ Cấp phát văn bằng (On-chain)

- Hệ thống gọi Smart Contract
- Băm dữ liệu bằng thuật toán SHA-256
- Lưu bằng chứng (Proof) lên Blockchain

---

## 🔍 Xác thực toàn vẹn dữ liệu (Verify)

Người dùng nhập chuỗi JSON Proof:

- Hệ thống truy xuất dữ liệu từ Blockchain
- Tự động hash lại dữ liệu Off-chain
- So khớp tính toàn vẹn
- Phát hiện ngay các thay đổi trái phép

---

# Troubleshooting

## Không kết nối được Smart Contract

### Nguyên nhân:
Chưa tạo Wallet định danh.

### Cách khắc phục:
Đảm bảo đã chạy:

```bash
node src/lib/fabric/enrollAdmin.js

node src/lib/fabric/registerUser.js
```

---

## Không kết nối được MongoDB Atlas

### Kiểm tra:
- IP Access List trên MongoDB Atlas
- Đảm bảo IP hiện tại đã được cấp quyền truy cập

---

## Xung đột Docker Container

Dọn dẹp toàn bộ container cũ:

```bash
docker rm -f $(docker ps -aq)
```

---

# Kiến trúc lưu trữ Hybrid

```txt
                +----------------------+
                |     Next.js App      |
                +----------+-----------+
                           |
         +-----------------+-----------------+
         |                                   |
         v                                   v

+-------------------+          +----------------------+
| MongoDB Atlas     |          | Hyperledger Fabric   |
| Off-chain Storage |          | On-chain Storage     |
+-------------------+          +----------------------+

         |                                   |
         +-----------------+-----------------+
                           |
                           v
                +----------------------+
                | Verification Engine  |
                +----------------------+
```
