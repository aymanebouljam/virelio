import * as bcrypt from 'bcrypt';

type SeedUser = {
  email: string;
  passwordHash: string;
  fullName: string;
};

export async function createSeedUser(): Promise<SeedUser> {
  return {
    email: 'local@example.com',
    passwordHash: await bcrypt.hash('password', 10),
    fullName: 'Local Owner',
  };
}
