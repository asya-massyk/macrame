declare namespace NodeJS {
    interface ProcessEnv {
      DB_NAME: string;
      DB_USER: string;
      DB_PASS: string;
      DB_HOST: string;
      DB_DIALECT: string;
      JWT_SECRET: string;
      PORT?: string;
      GMAIL_USER: string;
      GMAIL_PASS: string;
      BASE_URL: string;
    }
  }
  