import { Sequelize, DataTypes, Model, Optional } from 'sequelize';

// Описуємо атрибути користувача
interface UserAttributes {
  id: number;
  username: string;
  email: string;
  password: string;
  isEmailConfirmed: boolean;  // додаємо поле для підтвердження пошти
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id'> {}

// Створення моделі
export class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  id!: number;
  username!: string;
  email!: string;
  password!: string;
  isEmailConfirmed!: boolean;
}

// Ініціалізація моделі
export const initUserModel = (sequelize: Sequelize) => {
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
      isEmailConfirmed: {
        type: DataTypes.BOOLEAN,
        defaultValue: false,
      },
    },
    {
      sequelize, // підключення до бази даних
      modelName: 'User',
    }
  );
};
