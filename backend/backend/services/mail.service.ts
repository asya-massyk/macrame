import nodemailer from 'nodemailer';

export const sendConfirmationEmail = async (email: string, confirmationToken: string) => {
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: process.env.GMAIL_USER, 
      pass: process.env.GMAIL_PASS,
    },
  });

  const confirmationUrl = `${process.env.BASE_URL}/confirm-email?token=${confirmationToken}`;

  const mailOptions = {
    from: process.env.GMAIL_USER, 
    to: email,
    subject: 'Підтвердження електронної пошти',
    text: `Привіт! Будь ласка, натисни на посилання нижче для підтвердження реєстрації:\n${confirmationUrl}`,
  };

  try {
    await transporter.sendMail(mailOptions);
  } catch (error) {
    console.error('Помилка надсилання листа:', error);
  }
};
