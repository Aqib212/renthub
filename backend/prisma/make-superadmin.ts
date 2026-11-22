// Make an existing account the platform super-admin: npm run make-superadmin -- someone@example.com
// The only way to grant the role (no API does it).
import { PrismaClient } from "@prisma/client";

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run make-superadmin -- <email>");
  process.exit(1);
}
const prisma = new PrismaClient();
prisma.user
  .update({ where: { email }, data: { role: "SUPER_ADMIN" }, select: { email: true, role: true } })
  .then((u) => console.log(`${u.email} is now ${u.role}. Log in again to open /admin.`))
  .catch(() => {
    console.error(`No account with the email ${email}. Register it first.`);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
