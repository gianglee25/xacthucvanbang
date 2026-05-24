"use client";

import React, { useState } from 'react';
import { Table, Button, Typography, Modal, Form, Input, message } from 'antd';
import { useRouter } from 'next/navigation';

const { Title, Text } = Typography;

export default function StudentsClient({ initialData }: { initialData: any[] }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const router = useRouter();

  const columns = [
    { title: 'Họ và tên', dataIndex: 'name', key: 'name', fontWeight: 'bold' },
    { title: 'Tài khoản Email', dataIndex: 'email', key: 'email' },
    { 
      title: 'MSSV (Định danh Fabric)', 
      dataIndex: 'studentId', 
      key: 'studentId',
      render: (text: string) => <Text code>{text}</Text>
    },
  ];

  const handleAddStudent = async (values: any) => {
    setLoading(true);
    try {
      const res = await fetch('/api/students', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(values),
      });
      
      if (res.ok) {
        message.success('Đã thêm sinh viên vào Database (Off-chain)!');
        setIsModalOpen(false);
        form.resetFields();
        router.refresh(); // Tải lại dữ liệu mới nhất từ Server
      } else {
        message.error('Lỗi: Email hoặc MSSV đã tồn tại.');
      }
    } catch (error) {
      message.error('Lỗi kết nối máy chủ.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="flex justify-between items-center mb-8 border-b pb-4">
          <div>
            <Title level={2} style={{ margin: 0 }}>QUẢN LÝ SINH VIÊN</Title>
          </div>
          <Button type="primary" size="large" onClick={() => setIsModalOpen(true)}>
            + Thêm Sinh Viên Mới
          </Button>
        </div>

        <Table 
          dataSource={initialData} 
          columns={columns} 
          rowKey="id" 
          bordered 
          pagination={{ pageSize: 10 }}
        />

        {/* Popup nhập thông tin sinh viên */}
        <Modal 
          title="Đăng ký thông tin Sinh viên" 
          open={isModalOpen} 
          onCancel={() => setIsModalOpen(false)} 
          footer={null}
        >
          <Form form={form} layout="vertical" onFinish={handleAddStudent} className="mt-4">
            <Form.Item name="name" label="Họ và tên" rules={[{ required: true, message: 'Vui lòng nhập họ tên' }]}>
              <Input placeholder="VD: Lê Hoàng Giang" size="large" />
            </Form.Item>
            <Form.Item name="email" label="Email trường cấp" rules={[{ required: true, type: 'email' }]}>
              <Input placeholder="VD: giang@tlu.edu.vn" size="large" />
            </Form.Item>
            <Form.Item name="studentId" label="Mã số sinh viên (MSSV)" rules={[{ required: true }]}>
              <Input placeholder="VD: 2051120... (Quan trọng: Dùng để cấp bằng)" size="large" />
            </Form.Item>
            <Button type="primary" htmlType="submit" block size="large" loading={loading}>
              Lưu vào Cơ sở dữ liệu
            </Button>
          </Form>
        </Modal>
      </div>
    </div>
  );
}