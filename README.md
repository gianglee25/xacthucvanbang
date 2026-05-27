# Hệ thống Xác thực Văn bằng Blockchain - ĐH Thủy Lợi

## Yêu cầu
- Docker + Docker Compose v2
- Node.js >= 18
- Hyperledger Fabric binaries (peer, configtxgen...) trong `blockchain-network/bin/`

## Setup lần đầu

```bash
# 1. Clone repo
git clone https://github.com/gianglee25/xacthucvanbang.git
cd xacthucvanbang

# 2. Tạo file .env
cp .env.example .env  # Điền MONGODB_URI, NEXTAUTH_SECRET

# 3. Download Fabric binaries
cd blockchain-network
curl -sSL https://bit.ly/2ysbOFE | bash -s -- 2.5.15 1.5.15 -d -s
cd ..

# 4. Chạy setup tự động
chmod +x setup.sh && ./setup.sh

# 5. Khởi động app
NODE_TLS_REJECT_UNAUTHORIZED=0 npm run dev
```

## Kiến trúc
- **Org1MSP** = Trường ĐH Thủy Lợi (Cơ sở chính - Hà Nội)
- **Org2MSP** = Phân hiệu TP.HCM
- **Endorsement Policy**: `AND('Org1MSP.peer', 'Org2MSP.peer')` — bắt buộc cả 2 org ký

## Tính năng
- Cấp văn bằng số lên Blockchain với chữ ký 2 tổ chức
- Xác thực 3 chiều: Proof + MongoDB + Blockchain
- Phát hiện giả mạo khi sửa bất kỳ nguồn dữ liệu nào
