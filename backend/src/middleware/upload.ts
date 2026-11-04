import multer from 'multer';
import { Request } from 'express';

const MAX_FILE_SIZE = (parseInt(process.env.MAX_FILE_SIZE_MB || '5', 10)) * 1024 * 1024;

const ALLOWED_MIME_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/msword',
];

const ALLOWED_EXTENSIONS = ['.pdf', '.docx', '.doc'];

const fileFilter = (
  req: Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  const extension = '.' + file.originalname.split('.').pop()?.toLowerCase();
  
  const isMimeValid = ALLOWED_MIME_TYPES.includes(file.mimetype);
  const isExtValid = ALLOWED_EXTENSIONS.includes(extension);

  if (isMimeValid || isExtValid) {
    cb(null, true);
  } else {
    const error: any = new Error('Invalid file type. Only PDF and DOCX resumes are supported.');
    error.statusCode = 400;
    cb(error);
  }
};

// Use memoryStorage for secure, in-memory processing without disk traversal risks
const storage = multer.memoryStorage();

export const uploadResume = multer({
  storage,
  limits: {
    fileSize: MAX_FILE_SIZE,
  },
  fileFilter,
});
