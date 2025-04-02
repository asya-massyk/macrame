import express from 'express';
import { register, confirmEmail } from '../controllers/auth.controller';

const router = express.Router();

router.post('/register', register);
router.get('/confirm-email', confirmEmail); // Підтвердження email

export default router;
