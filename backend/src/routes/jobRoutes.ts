import { Router } from 'express';
import { handleGetJobs, handleGetJobById } from '../controllers/jobController';

const router = Router();

router.get('/', handleGetJobs);
router.get('/:jobId', handleGetJobById);

export default router;

