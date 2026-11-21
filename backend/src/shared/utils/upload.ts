import multer from "multer";
import path from "path";
import crypto from "crypto";
import fs from "fs";

export const uploadsDir = path.resolve(__dirname, "../../../uploads");
fs.mkdirSync(uploadsDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${crypto.randomBytes(16).toString("hex")}${ext}`);
  },
});

const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowed = /\.(jpg|jpeg|png|gif|webp|pdf|doc|docx)$/i;
  if (allowed.test(path.extname(file.originalname))) {
    cb(null, true);
  } else {
    cb(new Error("Only images (jpg, png, gif, webp) and documents (pdf, doc) are allowed"));
  }
};

export const upload = multer({
  storage,
  fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 },
});

export const uploadFields = upload.fields([
  { name: "photo", maxCount: 1 },
  { name: "agreementDoc", maxCount: 1 },
]);
