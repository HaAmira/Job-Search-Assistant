import { Router } from 'express';
import { uploadResume } from '../middleware/upload';
import {
  handleResumeUpload,
  handleUpdateResume,
  handleGetResume,
} from '../controllers/resumeController';

const router = Router();

router.post('/upload', uploadResume.single('resume'), handleResumeUpload);
router.put('/', handleUpdateResume);
router.get('/', handleGetResume);

export default router;

