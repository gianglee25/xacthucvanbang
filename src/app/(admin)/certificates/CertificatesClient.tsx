"use client";
import React, { useState } from "react";
import { Table, Button, Typography, Tag, message, Modal, Space, Tooltip } from "antd";
import { CopyOutlined, SafetyCertificateOutlined, CheckCircleFilled, CloseCircleFilled } from "@ant-design/icons";

const { Text } = Typography;

export default function CertificatesClient({ data }: { data: any[] }) {
  const [loadingVerify, setLoadingVerify] = useState<Record<string, boolean>>({});

  // ✅ Tạo proof JSON đầy đủ để copy — gồm uuid + certHash để verify được
  const buildProof = (record: any) =>
    JSON.stringify({
      certUUID:     record.uuid,
      certHash:     record.certHash,
      fullName:     record.fullName,
      mssv:         record.mssv,
      major:        record.major,
      gpa:          record.gpa,
      grade:        record.grade,
      issueDate:    record.issueDate,
      soHieu:       record.soHieu,
      soVaoSo:      record.soVaoSo,
      className:    record.className,
      namTotNghiep: record.namTotNghiep,
    }, null, 2);

  const handleVerify = async (record: any) => {
    setLoadingVerify((prev) => ({ ...prev, [record.uuid]: true }));
    try {
      const res = await fetch("/api/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          uuid:         record.uuid,
          certUUID:     record.uuid,
          certHash:     record.certHash,
          fullName:     record.fullName,
          mssv:         record.mssv,
          major:        record.major,
          gpa:          record.gpa,
          grade:        record.grade,
          issueDate:    record.issueDate,
          soHieu:       record.soHieu,
          soVaoSo:      record.soVaoSo,
          className:    record.className,
          namTotNghiep: record.namTotNghiep,
        }),
      });
      const result = await res.json();

      if (!result.success) {
        Modal.error({
          title: "Lỗi xác thực",
          content: result.error || "Không thể kết nối hệ thống xác thực.",
        });
        return;
      }

      const { isValid, details } = result;

      Modal[isValid ? "success" : "error"]({
        title: isValid ? (
          <span><CheckCircleFilled style={{ color: "#52c41a", marginRight: 8 }} />Văn bằng hợp lệ</span>
        ) : (
          <span><CloseCircleFilled style={{ color: "#ff4d4f", marginRight: 8 }} />CẢNH BÁO GIẢ MẠO!</span>
        ),
        width: 560,
        content: (
          <div style={{ fontSize: 13 }}>
            <p style={{ marginBottom: 12, color: isValid ? "#389e0d" : "#cf1322", fontWeight: 500 }}>
              {result.message}
            </p>
            {details && (
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <tbody>
                  {[
                    ["Sinh viên",     details.studentName],
                    ["MSSV",          details.mssv],
                    ["Ngày xác thực", details.blockchainDate],
                    ["Tx ID",         details.txId ? `${details.txId.substring(0, 20)}...` : "—"],
                  ].map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: "1px solid #f0f0f0" }}>
                      <td style={{ padding: "6px 8px", color: "#888", width: 130 }}>{label}</td>
                      <td style={{ padding: "6px 8px", fontWeight: 500 }}>{value || "—"}</td>
                    </tr>
                  ))}
                  <tr style={{ borderBottom: "1px solid #f0f0f0" }}>
                    <td style={{ padding: "6px 8px", color: "#888" }}>Hash blockchain</td>
                    <td style={{ padding: "6px 8px" }}>
                      <Text code copyable={{ text: details.onChainHash }} style={{ fontSize: 11 }}>
                        {details.onChainHash?.substring(0, 20)}...
                      </Text>
                    </td>
                  </tr>
                  {!isValid && (
                    <tr>
                      <td style={{ padding: "6px 8px", color: "#888" }}>Hash hiện tại</td>
                      <td style={{ padding: "6px 8px" }}>
                        <Text code style={{ fontSize: 11, color: "#cf1322" }}>
                          {details.currentHash?.substring(0, 20)}...
                        </Text>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            )}
          </div>
        ),
      });
    } catch {
      message.error("Lỗi kết nối server xác thực!");
    } finally {
      setLoadingVerify((prev) => ({ ...prev, [record.uuid]: false }));
    }
  };

  const columns = [
    { title: "Sinh viên",    dataIndex: "fullName", key: "fullName", width: 180 },
    {
      title: "MSSV", dataIndex: "mssv", key: "mssv", width: 120,
      render: (v: string) => v || <i style={{ color: "#bbb" }}>—</i>,
    },
    { title: "Ngành đào tạo", dataIndex: "major", key: "major" },
    { title: "Xếp loại",     dataIndex: "grade", key: "grade", width: 130 },
    {
      title: "Mã Hash (On-chain)", dataIndex: "certHash", key: "certHash", width: 160,
      render: (hash: string) => (
        <Tooltip title={hash}>
          <Text code style={{ fontSize: 11 }}>{hash?.substring(0, 12)}...</Text>
        </Tooltip>
      ),
    },
    {
      title: "Trạng thái", dataIndex: "status", key: "status", width: 160,
      render: (status: string) => (
        <Tag color={status === "ON_CHAIN" ? "green" : "red"}>
          {status === "ON_CHAIN" ? "ĐÃ LÊN BLOCKCHAIN" : "LỖI"}
        </Tag>
      ),
    },
    {
      title: "Hành động", key: "action", width: 200,
      render: (_: any, record: any) => (
        <Space>
          <Button
            type="primary"
            icon={<SafetyCertificateOutlined />}
            onClick={() => handleVerify(record)}
            loading={loadingVerify[record.uuid]}
            size="small"
          >
            Verify
          </Button>
          {/* ✅ Copy PROOF JSON đầy đủ thay vì chỉ copy hash */}
          <Tooltip title="Copy chuỗi Proof JSON để gửi cho người cần xác thực">
            <Button
              icon={<CopyOutlined />}
              size="small"
              onClick={() => {
                navigator.clipboard.writeText(buildProof(record));
                message.success("Đã copy Proof JSON! Dán vào trang Xác thực để kiểm định.");
              }}
            >
              Copy Proof
            </Button>
          </Tooltip>
        </Space>
      ),
    },
  ];

  return (
    <div className="p-8 bg-white min-h-screen">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6">
          <Typography.Title level={2}>KHO LƯU TRỮ VĂN BẰNG & KIỂM ĐỊNH</Typography.Title>
          <Typography.Text type="secondary">
            Nhấn <strong>Verify</strong> để đối soát trực tiếp. Nhấn <strong>Copy Proof</strong> để lấy chuỗi minh chứng gửi cho bên thứ ba xác thực.
          </Typography.Text>
        </div>
        <Table
          dataSource={data}
          columns={columns}
          rowKey="uuid"
          bordered
          size="small"
          pagination={{ pageSize: 10, showSizeChanger: true }}
          rowClassName={(record) => (record.status !== "ON_CHAIN" ? "bg-red-50" : "")}
        />
      </div>
    </div>
  );
}
