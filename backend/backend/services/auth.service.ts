import jwt from 'jsonwebtoken';

export const generateConfirmationToken = (userId: number) => {
  return jwt.sign({ userId }, process.env.JWT_SECRET || 'your-secret-key', { expiresIn: '1h' });
};
