export const serverConfig = {
  port: Number(process.env.PORT ?? 3001),
  localUserId: process.env.LOCAL_USER_ID ?? 'local-user',
  databaseUrl: process.env.DATABASE_URL ?? '',
  uploadDir: process.env.UPLOAD_DIR ?? 'D:\\yxy5.0\\data\\uploads',
};
