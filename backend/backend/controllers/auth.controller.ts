import { Request, Response, NextFunction } from 'express';
import bcrypt from 'bcryptjs';
import { User } from '../models/User';
import { sendConfirmationEmail } from '../services/mail.service'; // Імпортуємо функцію для надсилання листа
import { generateConfirmationToken } from '../services/auth.service'; // Імпортуємо функцію для генерації токену
import { Sequelize } from 'sequelize';
import { Op } from 'sequelize';
import jwt from 'jsonwebtoken';

export const register = async (req: Request, res: Response, next: NextFunction) => {
    const { username, email, password } = req.body;

    if (password.length < 8) {
        return res.status(400).json({ message: 'Пароль має містити не менше 8 символів' });
    }
    if (!username || !email || !password) {
        return res.status(400).json({ message: 'Всі поля повинні бути заповнені' });
    }

    try {
        // Перевірка чи існує користувач з таким ім'ям або email
        console.log('Перевірка на існуючого користувача...');
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
        console.log('Надсилання листа...');
        await sendConfirmationEmail(newUser.email, confirmationToken);

        res.status(201).json({ message: 'Користувач успішно зареєстрований! Перевірте свою пошту для підтвердження.' });
    } catch (err) {
        console.error(err);
        next(err);
    }
};
  
export const confirmEmail = async (req: Request, res: Response, next: NextFunction) => {
    const { token } = req.query;

    console.log('Токен підтвердження:', token); // Додати лог

    try {
        const decoded: any = jwt.verify(token as string, process.env.JWT_SECRET || 'your-secret-key');
        const userId = decoded.userId;

        console.log('Підтвердження користувача:', userId); // Додати лог

        await User.update({ isEmailConfirmed: true }, { where: { id: userId } });

        res.status(200).json({ message: 'Email успішно підтверджено!' });
    } catch (error) {
        console.error('Помилка підтвердження:', error);
        res.status(400).json({ message: 'Невірний або застарілий токен підтвердження.' });
    }
};
