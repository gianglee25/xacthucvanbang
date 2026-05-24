'use client';

import React from 'react';
import { Card, Typography, Button, Space, Row, Col } from 'antd';
import { SearchOutlined, SafetyCertificateOutlined, LoginOutlined } from '@ant-design/icons';
import { useRouter } from 'next/navigation';

const { Title, Paragraph, Text } = Typography;

export default function HomePage() {
  const router = useRouter();

  return (
    <div className="min-h-[85vh] bg-gray-50 flex flex-col items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full text-center space-y-8">
        
        {/* Tiêu đề chính */}
        <div>
          <Title level={2} className="text-gray-900 tracking-tight">
            HỆ THỐNG QUẢN LÝ VÀ XÁC THỰC VĂN BẰNG
          </Title>

        </div>

        {/* Các nút hành động chính */}
        <Card className="mt-8 shadow-sm border-gray-200 rounded-xl bg-white p-4">
          <Row gutter={[24, 24]} justify="center">
            
            {/* Phân hệ Tra cứu (Public) */}
            <Col xs={24} sm={12} md={8}>
              <div className="flex flex-col items-center p-4">
                <Title level={5}>Nhà Tuyển Dụng</Title>
                <Text className="text-center text-gray-500 mb-4 block h-12">
                  Tra cứu và kiểm định tính hợp lệ của văn bằng.
                </Text>
                <Button 
                  type="primary" 
                  size="large" 
                  className="bg-green-600 hover:bg-green-700 w-full"
                  onClick={() => router.push('/verify')}
                >
                  Xác thực ngay
                </Button>
              </div>
            </Col>

            {/* Phân hệ Sinh viên */}
            <Col xs={24} sm={12} md={8}>
              <div className="flex flex-col items-center p-4 border-l border-r border-gray-100">
                <Title level={5}>Sinh Viên</Title>
                <Text className="text-center text-gray-500 mb-4 block h-12">
                  Quản lý và chia sẻ minh chứng văn bằng ZKP.
                </Text>
                <Button 
                  type="default" 
                  size="large" 
                  icon={<LoginOutlined />}
                  className="w-full border-blue-600 text-blue-600 hover:text-blue-700"
                  onClick={() => router.push('/login?type=student')}
                >
                  Đăng nhập
                </Button>
              </div>
            </Col>

            {/* Phân hệ Nhà trường */}
            <Col xs={24} sm={12} md={8}>
              <div className="flex flex-col items-center p-4">
                <Title level={5}>Cơ Sở Đào Tạo</Title>
                <Text className="text-center text-gray-500 mb-4 block h-12">
                  Quản trị và phát hành văn bằng lên Blockchain.
                </Text>
                <Button 
                  type="primary" 
                  size="large" 
                  className="bg-purple-600 hover:bg-purple-700 w-full"
                  onClick={() => router.push('/login?type=university')}
                >
                  Cán bộ quản lý
                </Button>
              </div>
            </Col>

          </Row>
        </Card>

      </div>
    </div>
  );
}