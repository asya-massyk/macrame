import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine } from '@angular/ssr';
import express, { Request, Response, NextFunction } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join, resolve } from 'node:path';
import bootstrap from './src/main.server';
import dotenv from 'dotenv';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { Sequelize, DataTypes, Optional, Model} from 'sequelize';

// Завантаження змінних середовища
dotenv.config();

// Підключення до бази даних
const sequelize = new Sequelize(
  process.env['DB_NAME']!,
  process.env['DB_USER']!,
  process.env['DB_PASS']!,
  {
    host: process.env['DB_HOST'],
    dialect: process.env['DB_DIALECT'] as 'postgres',
  }
);


// Створення інтерфейсів
interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

// Визначення моделі
class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  id!: number;
  username!: string;
  email!: string;
  password!: string;
}

// Опис моделі в Sequelize
User.init(
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    username: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    email: {
      type: DataTypes.STRING,
      allowNull: false,
      unique: true,
    },
    password: {
      type: DataTypes.STRING,
      allowNull: false,
    },
  },
  {
    sequelize, // з'єднання з базою даних
    modelName: 'User',
  }
);


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

export function app(): express.Express {
  const server = express();
  const serverDistFolder = dirname(fileURLToPath(import.meta.url));
  const browserDistFolder = resolve(serverDistFolder, '../browser');
  const indexHtml = join(serverDistFolder, 'index.server.html');

  const commonEngine = new CommonEngine();

  server.set('view engine', 'html');
  server.set('views', browserDistFolder);

  // Маршрут для авторизації
  server.post('/api/login', async (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    try {
      const user = await authenticateUser(username, password);
      const token = generateJWT(user);
      res.json({ token });
    } catch (err: unknown) {
      if (err instanceof Error) {
        next(err);
      } else {
        next(new Error('An unknown error occurred'));
      }
    }
  });

  // Serve static files from /browser
  server.get('**', express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html',
  }));

  // All regular routes use the Angular engine
  server.get('**', (req, res, next) => {
    const { protocol, originalUrl, baseUrl, headers } = req;

    commonEngine
      .render({
        bootstrap,
        documentFilePath: indexHtml,
        url: `${protocol}://${headers.host}${originalUrl}`,
        publicPath: browserDistFolder,
        providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
      })
      .then((html) => res.send(html))
      .catch((err) => next(err));
  });

  return server;
}

function run(): void {
  const port = process.env['PORT'] || 4000;

  // Підключення до бази даних і запуск сервера
  sequelize.authenticate()
    .then(() => {
      console.log('✅ Підключено до бази даних PostgreSQL');
    })
    .catch((error) => {
      console.error('❌ Помилка підключення до бази даних:', error);
    });

  const server = app();
  server.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

run();
