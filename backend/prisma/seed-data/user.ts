import * as bcrypt from 'bcrypt';

type SeedUser = {
  email: string;
  passwordHash: string;
  fullName: string;
};

export const seedUserEmail = 'local@example.com';

export async function createSeedUser(): Promise<SeedUser> {
  return {
    email: seedUserEmail,
    passwordHash: await bcrypt.hash('password', 10),
    fullName: 'Local Owner',
  };
}
