import nodemailer from 'nodemailer';

export const sendConfirmationEmail = async (email: string, confirmationToken: string) => {
  // Створення транспорту для відправки листів через Gmail
  const transporter = nodemailer.createTransport({
    service: 'gmail',  // можеш змінити на інший SMTP-сервер
    auth: {
      user: process.env.GMAIL_USER,  // твоя пошта
      pass: process.env.GMAIL_PASS,  // пароль або App пароль для Gmail
    },
  });

  const confirmationUrl = `${process.env.BASE_URL}/confirm-email?token=${confirmationToken}`;

  const mailOptions = {
    from: process.env.GMAIL_USER,  // твоя пошта
    to: email,
    subject: 'Підтвердження електронної пошти',
    text: `Привіт! Будь ласка, натисни на посилання нижче для підтвердження реєстрації:
    ${confirmationUrl}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Помилка надсилання листа:', error);
  }
};
