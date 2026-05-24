"use client";

import React, { useState } from "react";
import {
  Card,
  Row,
  Col,
  Typography,
  Statistic,
  Button,
  message,
  Tag,
} from "antd";
import Link from "next/link";
import {
  SyncOutlined,
  DatabaseOutlined,
  SafetyCertificateOutlined,
} from "@ant-design/icons";

const { Title, Text } = Typography;

export default function DashboardClient({ stats }: { stats: any }) {
  const [isSyncing, setIsSyncing] = useState(false);

  // Logic phục hồi dữ liệu từ Blockchain
  const handleSync = async () => {
    setIsSyncing(true);
    try {
      // Sửa thành:
      const res = await fetch("/api/sync", { method: "POST" });
      const data = await res.json();
      if (data.success) {
        message.success(data.message);
        setTimeout(() => window.location.reload(), 1000);
      } else {
        message.error("Lỗi: " + data.error);
      }
    } catch (err) {
      message.error("Không thể kết nối đến hệ thống đồng bộ!");
    } finally {
      setIsSyncing(false);
    }
  };

  const isSynced = stats.totalOnChain === stats.totalOffChain;

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-10 border-b pb-6">
          <div>
            <Title level={2} style={{ margin: 0, color: "#002140" }}>
              HỆ THỐNG QUẢN TRỊ VĂN BẰNG BLOCKCHAIN
            </Title>
            <Text type="secondary" style={{ fontSize: "16px" }}>
              Trường Đại học Thủy lợi | Phân hệ Cán bộ Quản lý
            </Text>
          </div>

          {/* Nút phục hồi dữ liệu - Minh chứng cho tính Self-Healing */}
          <Button
            type="primary"
            danger
            icon={<SyncOutlined spin={isSyncing} />}
            loading={isSyncing}
            onClick={handleSync}
            size="large"
            className="shadow-md"
          >
            Tự chữa lành (Sync từ Blockchain)
          </Button>
        </div>

        {/* Khối thống kê và Trạng thái đồng bộ */}
        <Row gutter={24} className="mb-12">
          <Col span={6}>
            <Card variant="borderless" className="bg-gray-50">
              <Statistic title="TỔNG SINH VIÊN" value={stats.totalStudents} />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless" className="bg-gray-50">
              <Statistic
                title="OFF-CHAIN (MONGODB)"
                value={stats.totalOffChain}
                suffix="Bản ghi"
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless" className="bg-gray-50">
              <Statistic
                title="ON-CHAIN (BLOCKCHAIN)"
                value={stats.totalOnChain}
                valueStyle={{ color: "#3f8600" }}
                prefix={<SafetyCertificateOutlined />}
              />
            </Card>
          </Col>
          <Col span={6}>
            <Card variant="borderless" className="bg-gray-50">
              <Statistic
                title="TRẠNG THÁI ĐỒNG BỘ"
                value={isSynced ? "ĐỒNG NHẤT" : "LỆCH DỮ LIỆU"}
                valueStyle={{
                  color: isSynced ? "#3f8600" : "#cf1322",
                  fontSize: "20px",
                }}
              />
              <Tag color={isSynced ? "success" : "error"} className="mt-2">
                {isSynced ? "Dữ liệu an toàn" : "Cần phục hồi"}
              </Tag>
            </Card>
          </Col>
        </Row>

        {/* Các nút điều hướng */}
        <Row gutter={[24, 24]}>
          {[
            { name: "Quản lý Sinh viên", path: "/students", color: "#096dd9" },
            { name: "Cấp phát Văn bằng", path: "/issue", color: "#389e0d" },
            {
              name: "Kho Lưu trữ Tạm",
              path: "/certificates",
              color: "#d48806",
            },
            { name: "Nhập liệu Excel", path: "/import", color: "#722ed1" },
          ].map((m) => (
            <Col xs={24} sm={6} key={m.path}>
              <Card
                hoverable
                className="border-t-4"
                style={{ borderTopColor: m.color }}
              >
                <Title level={5}>{m.name}</Title>
                <Link href={m.path}>
                  <Button type="primary" ghost size="small" className="mt-2">
                    Truy cập →
                  </Button>
                </Link>
              </Card>
            </Col>
          ))}
        </Row>
      </div>
    </div>
  );
}
