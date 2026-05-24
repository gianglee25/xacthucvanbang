import mongoose from 'mongoose';
import { DIPLOMA_STATUS, DIPLOMA_TYPES } from '@/utils/constants';

const certificateSchema = new mongoose.Schema(
  {
    // Định danh văn bằng
    uuid: { type: String, required: true, unique: true },
    certHash: { type: String, required: true }, // Mã băm SHA-256 (On-chain proof)
    txId: { type: String, default: null },      // Transaction ID từ Blockchain

    // Thông tin sinh viên (Đồng bộ với Sổ gốc)
    mssv: { type: String, required: true },
    fullName: { type: String, required: true },
    dob: { type: String },
    pob: { type: String },
    gender: { type: String },
    nation: { type: String },
    class: { type: String },
    
    // Thông tin văn bằng (Chuẩn theo TLU)
    major: { type: String },
    gpa: { type: Number },
    grade: { type: String },
    diplomaType: { type: String, default: DIPLOMA_TYPES?.ENGINEER || 'ENGINEER' },
    
    // Các trường đối soát sổ gốc của TLU
    certNo: { type: String },       // Số hiệu văn bằng
    regNo: { type: String },        // Số vào sổ cấp bằng
    decisionNo: { type: String },
    issueDate: { type: String },
    
    pdfUrl: { type: String, default: null },
    
    status: {
      type: String,
      default: DIPLOMA_STATUS?.ON_CHAIN || 'ON_CHAIN',
    },

    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: true }
);

export const Certificate = mongoose.models.Certificate || mongoose.model('Certificate', certificateSchema);