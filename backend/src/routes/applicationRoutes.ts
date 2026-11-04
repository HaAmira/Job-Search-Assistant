import { Router } from 'express';
import {
  handleApply,
  handleGetApplications,
  handleGetApplicationById,
} from '../controllers/appController';

const router = Router();

router.post('/', handleApply);
router.get('/', handleGetApplications);
router.get('/:applicationId', handleGetApplicationById);

export default router;

