import jwt from 'jsonwebtoken';

// Функція для створення токену підтвердження електронної пошти
export const generateConfirmationToken = (userId: number) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET!, { expiresIn: '1h' }); // Термін дії токену — 1 година
};
