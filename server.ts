import express, { Request, Response, NextFunction } from 'express';
import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { initUserModel, User } from './backend/backend/models/User'; 


dotenv.config();

// Підключення до бази даних
const sequelize = new Sequelize(
  process.env['DB_NAME']!,
  process.env['DB_USER']!,
  process.env['DB_PASS']!,
  {
    host: process.env['DB_HOST'],
    dialect: 'postgres', // можна змінити на іншу СУБД, якщо потрібно
  }
);

// Ініціалізація моделі користувача
initUserModel(sequelize);

// Авторизація користувача
const authenticateUser = async (username: string, password: string) => {
  const user = await User.findOne({ where: { username } });
  if (!user) {
    throw new Error('Користувача не знайдено');
  }

  const isMatch = bcrypt.compareSync(password, user.password);
  if (!isMatch) {
    throw new Error('Невірний пароль');
  }

  return user;
};

// Створення JWT токену
const generateJWT = (user: any) => {
  return jwt.sign({ id: user.id, username: user.username }, process.env['JWT_SECRET']!, { expiresIn: '1h' });
};

// Запуск сервера
const app = express();
app.use(express.json());

// Маршрут для авторизації
app.post('/api/login', async (req: Request, res: Response, next: NextFunction) => {
  const { username, password } = req.body;

  try {
    const user = await authenticateUser(username, password);
    const token = generateJWT(user);
    res.json({ token });
  } catch (err: unknown) {
    next(err);
  }
});

// Маршрут для реєстрації користувача
app.post('/api/register', async (req: Request, res: Response, next: NextFunction) => {
  const { username, email, password } = req.body;

  try {
    const hashedPassword = await bcrypt.hash(password, 10);
    const newUser = await User.create({
      username, email, password: hashedPassword,
      isEmailConfirmed: false
    });

    // Генерація токену для підтвердження пошти
    const confirmationToken = jwt.sign({ id: newUser.id }, process.env['JWT_SECRET']!, { expiresIn: '1h' });

    // Відправка email для підтвердження (потрібно налаштувати email-сервер)

    res.status(201).json({ message: 'Користувача успішно зареєстровано! Перевірте вашу пошту для підтвердження.' });
  } catch (err) {
    next(err);
  }
});

// Підключення до бази даних і запуск сервера
sequelize.authenticate()
  .then(() => {
    console.log('✅ Підключено до бази даних PostgreSQL');
  })
  .catch((error) => {
    console.error('❌ Помилка підключення до бази даних:', error);
  });

app.listen(4000, () => {
  console.log('Сервер працює на порту 4000');
});
