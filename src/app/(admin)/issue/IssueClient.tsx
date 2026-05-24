"use client";

import React, { useState } from "react";
import {
  Form,
  Select,
  Input,
  InputNumber,
  Button,
  Typography,
  message,
  Card,
} from "antd";
import { useRouter } from "next/navigation";

const { Title, Text } = Typography;

export default function IssueClient({ students }: { students: any[] }) {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const router = useRouter();

  const handleIssue = async (values: any) => {
    setLoading(true);
    try {
      const res = await fetch("/api/issue", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });

      if (res.ok) {
        message.success("Đã ký số và ghi sổ cái Blockchain thành công!");
        router.push("/dashboard"); // Quay lại để xem số nhảy
      } else {
        message.error("Lỗi khi ghi dữ liệu lên mạng lưới.");
      }
    } catch (error) {
      message.error("Lỗi kết nối máy chủ.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="max-w-3xl mx-auto">
        <Title level={2} className="mb-2">
          CẤP PHÁT VĂN BẰNG
        </Title>

        <Card
          variant="borderless"
          className="bg-gray-50 border-t-4 border-t-green-600"
        >
          <Form form={form} layout="vertical" onFinish={handleIssue}>
            <Form.Item
              name="studentObjId"
              label="Chọn Sinh viên"
              rules={[{ required: true }]}
            >
              <Select
                options={students}
                size="large"
                placeholder="Tra cứu sinh viên trong hệ thống..."
              />
            </Form.Item>

            <Form.Item
              name="major"
              label="Ngành đào tạo"
              rules={[{ required: true }]}
            >
              <Input size="large" placeholder="VD: Kỹ thuật phần mềm" />
            </Form.Item>

            <div className="flex gap-4">
              <Form.Item
                name="gpa"
                label="Điểm trung bình (GPA)"
                className="flex-1"
                rules={[{ required: true }]}
              >
                <InputNumber
                  size="large"
                  style={{ width: "100%" }}
                  step={0.01}
                  max={4.0}
                  min={0.0} // Nên có min để tránh nhập số âm
                  placeholder="VD: 3.51"
                  decimalSeparator="." // Đảm bảo dùng dấu chấm cho số thập phân
                />
              </Form.Item>

              <Form.Item
                name="classification"
                label="Xếp loại tốt nghiệp"
                className="flex-1"
                rules={[{ required: true }]}
              >
                <Select
                  size="large"
                  options={[
                    { value: "Xuất sắc", label: "Xuất sắc" },
                    { value: "Giỏi", label: "Giỏi" },
                    { value: "Khá", label: "Khá" },
                  ]}
                />
              </Form.Item>
            </div>

            <Button
              type="primary"
              htmlType="submit"
              size="large"
              block
              loading={loading}
              style={{ backgroundColor: "#389e0d" }}
            >
              Phát hành lên Blockchain
            </Button>
          </Form>
        </Card>
      </div>
    </div>
  );
}
