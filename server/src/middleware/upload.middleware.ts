import multer from 'multer';

export const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = [
      'image/jpeg',
      'image/png',
      'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
      'application/vnd.ms-excel',                                           // .xls
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document', // .docx
    ];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Supported formats: JPG, PNG, WebP, PDF, Excel (.xlsx), Word (.docx)'));
    }
  },
});
