"use client";

import React, { useState } from 'react';
import { Input, Button, Typography, message, Result, Descriptions, Tabs, Upload, Spin } from 'antd';
import { CheckCircleOutlined, CloseCircleOutlined, InboxOutlined } from '@ant-design/icons';

const { Title, Text } = Typography;
const { TextArea } = Input;
const { Dragger } = Upload;

// ✅ Parse linh hoạt: nhận JSON proof, UUID thuần, hoặc certHash thuần
function parseProofInput(raw: string): any | null {
  const s = raw.trim();
  if (!s) return null;
  try {
    const obj = JSON.parse(s);
    const uuid = obj.certUUID || obj.uuid;
    if (uuid) return { ...obj, uuid };
    if (obj.certHash) return obj;
  } catch {}
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)) {
    return { uuid: s };
  }
  if (/^[0-9a-f]{64}$/i.test(s)) {
    return { certHash: s };
  }
  return null;
}

export default function VerifyPage() {
  const [proofString, setProofString] = useState('');
  const [loading, setLoading] = useState(false);
  const [certData, setCertData] = useState<any>(null);
  const [verifyResult, setVerifyResult] = useState<{ isValid: boolean; message: string; details?: any } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');

  const executeVerification = async (payload: any) => {
    setLoading(true);
    setErrorMsg('');
    setCertData(null);
    setVerifyResult(null);
    try {
      const res = await fetch('/api/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        setVerifyResult(data);
        setCertData(data.details);
      } else {
        setErrorMsg(data.error || 'Xác thực thất bại.');
      }
    } catch {
      setErrorMsg('Lỗi kết nối đến mạng lưới Blockchain.');
    } finally {
      setLoading(false);
    }
  };

  // Tab 1: xác thực qua Proof JSON / UUID / Hash
  const handleVerifyProof = async () => {
    const parsed = parseProofInput(proofString);

    if (!parsed) {
      message.warning('Chuỗi không hợp lệ. Vui lòng dán Proof JSON, UUID, hoặc Hash 64 ký tự.');
      return;
    }

    // Gửi toàn bộ proof object để verify đúng hash
    if (parsed.uuid) {
      await executeVerification({ ...parsed, uuid: parsed.uuid });
    } else if (parsed.certHash) {
      await executeVerification({ certHash: parsed.certHash });
    }
  };

  // Tab 2: upload PDF (giữ nguyên logic cũ)
  const handlePdfUpload = (info: any) => {
    const file = info.file;
    setLoading(true);
    setErrorMsg('');
    setCertData(null);
    setVerifyResult(null);

    setTimeout(() => {
      const mssvMatch = file.name.match(/\d{8,10}/);
      const extractedMssv = mssvMatch ? mssvMatch[0] : null;

      if (extractedMssv) {
        message.success(`Đã quét thành công dữ liệu mã: ${extractedMssv}`);
        executeVerification({ mssv: extractedMssv });
      } else {
        setLoading(false);
        setErrorMsg('Tài liệu mờ hoặc không chứa chữ ký số/QR code hợp lệ. Vui lòng thử lại!');
      }
    }, 2000);

    return false;
  };

  const tabItems = [
    {
      key: '1',
      label: 'Chuỗi Minh Chứng (Proof)',
      children: (
        <div className="mt-4">
          <Text className="block mb-1 text-gray-600">
            Dán <strong>Proof JSON</strong> (từ nút Copy Proof), hoặc trực tiếp <strong>UUID</strong> / <strong>Hash</strong> của văn bằng:
          </Text>
          <Text type="secondary" className="block mb-3 text-xs">
            Ví dụ JSON: <code>{`{"certUUID":"...","certHash":"..."}`}</code>
          </Text>
          <TextArea
            rows={7}
            placeholder={`Dán Proof JSON:\n{\n  "certUUID": "xxxxxxxx-xxxx-...",\n  "certHash": "abc123...",\n  ...\n}\n\nHoặc chỉ UUID: xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx\nHoặc chỉ Hash: abc123def456... (64 ký tự)`}
            value={proofString}
            onChange={(e) => setProofString(e.target.value)}
            className="font-mono text-sm mb-4"
          />
          <Button type="primary" block size="large" onClick={handleVerifyProof} loading={loading}>
            Kiểm định
          </Button>
        </div>
      ),
    },
  ];

  const isValid = verifyResult?.isValid;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center pt-16 px-4">
      <div className="max-w-3xl w-full bg-white p-8 rounded-lg shadow-sm border">
        <div className="mb-8">
          <Title level={3} style={{ margin: 0 }}>Cổng Xác Thực Văn Bằng Số</Title>
        </div>

        <Tabs defaultActiveKey="1" items={tabItems} />

        {/* Kết quả hợp lệ */}
        {verifyResult && isValid && certData && (
          <div className="mt-8 pt-8 border-t">
            <Result
              icon={<CheckCircleOutlined style={{ color: '#52c41a' }} />}
              title="VĂN BẰNG HỢP LỆ & TOÀN VẸN"
              subTitle={
                <Text copyable={{ text: certData.onChainHash }} className="text-gray-500 text-xs font-mono">
                  Hash: {certData.onChainHash?.substring(0, 32)}...
                </Text>
              }
            >
              <Descriptions bordered column={1} size="small" className="bg-gray-50">
                <Descriptions.Item label="Họ và tên"><b>{certData.studentName}</b></Descriptions.Item>
                <Descriptions.Item label="Mã sinh viên">{certData.mssv}</Descriptions.Item>
                <Descriptions.Item label="Ngày xác thực trên BC">{certData.blockchainDate}</Descriptions.Item>
                <Descriptions.Item label="Tx ID">
                  <Text code style={{ fontSize: 11 }}>{certData.txId}</Text>
                </Descriptions.Item>
                <Descriptions.Item label="Mạng lưới">Hyperledger Fabric (channel-vb-tlu)</Descriptions.Item>
              </Descriptions>
            </Result>
          </div>
        )}

        {/* Kết quả không hợp lệ từ verify */}
        {verifyResult && !isValid && (
          <div className="mt-8 pt-8 border-t">
            <Result
              icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              title="CẢNH BÁO: VĂN BẰNG KHÔNG HỢP LỆ"
              subTitle={<span className="text-red-500 font-medium">{verifyResult.message}</span>}
            />
          </div>
        )}

        {/* Lỗi kết nối / không tìm thấy */}
        {errorMsg && (
          <div className="mt-8 pt-8 border-t">
            <Result
              icon={<CloseCircleOutlined style={{ color: '#ff4d4f' }} />}
              title="CẢNH BÁO TỪ HỆ THỐNG"
              subTitle={<span className="text-red-500 font-medium">{errorMsg}</span>}
            />
          </div>
        )}
      </div>
    </div>
  );
}
