import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { sendConfirmationEmail } from '../services/mail.service'; // Імпортуємо функцію для надсилання листа
import { generateConfirmationToken } from '../services/auth.service'; // Імпортуємо функцію для генерації токену
import { Sequelize } from 'sequelize';
import { Op } from 'sequelize';

export const register = async (req: Request, res: Response, next: NextFunction) => {
    const { username, email, password } = req.body;
  
    if (!username || !email || !password) {
      return res.status(400).json({ message: 'Всі поля повинні бути заповнені' });
    }
  
    try {
      // Перевірка чи існує користувач з таким ім'ям або email
      const existingUser = await User.findOne({
        where: { [Op.or]: [{ username }, { email }] },
      });
  
      if (existingUser) {
        return res.status(400).json({ message: 'Користувач з таким ім\'ям або email вже існує' });
      }
  
      // Хешування пароля перед збереженням
      const hashedPassword = await bcrypt.hash(password, 10);
  
      // Створення нового користувача
      const newUser = await User.create({
          username,
          email,
          password: hashedPassword,
          isEmailConfirmed: false
      });
  
      // Генерація токену для підтвердження пошти
      const confirmationToken = generateConfirmationToken(newUser.id);
  
      // Надсилання листа для підтвердження пошти
      await sendConfirmationEmail(newUser.email, confirmationToken);
  
      res.status(201).json({ message: 'Користувач успішно зареєстрований! Перевірте свою пошту для підтвердження.' });
    } catch (err) {
      next(err);
    }
  };
  
