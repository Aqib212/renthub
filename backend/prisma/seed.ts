import { PrismaClient, InvoiceStatus, ExpenseCategory } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data in dependency order
  await prisma.payment.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.billEntry.deleteMany();
  await prisma.flatCharge.deleteMany();
  await prisma.billType.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.flat.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ownerProfile.deleteMany();
  await prisma.user.deleteMany();

  const password = await bcrypt.hash("Test1234", 12);

  // ==============================
  // 1. USERS — auto-generated BigInt IDs
  // ==============================
  const owner = await prisma.user.create({
    data: {
      email: "owner@demo.com",
      password,
      firstName: "Rafiq",
      lastName: "Hasan",
      role: "HOUSE_OWNER",
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  const owner2 = await prisma.user.create({
    data: {
      email: "owner2@demo.com",
      password,
      firstName: "Farzana",
      lastName: "Ahmed",
      role: "HOUSE_OWNER",
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  await prisma.ownerProfile.create({
    data: {
      userId: owner.id,
      occupation: "Businessman",
      presentAddress: "Gulshan, Dhaka",
    },
  });

  await prisma.ownerProfile.create({
    data: {
      userId: owner2.id,
      occupation: "Doctor",
      presentAddress: "Banani, Dhaka",
    },
  });

  // ==============================
  // 2. BUILDINGS (owner 1)
  // ==============================
  const building1 = await prisma.building.create({
    data: {
      ownerId: owner.id,
      name: "Rafiq Villa",
      holdingNumber: "H-12/A",
      address: "123 Gulshan Avenue",
      ward: "Ward 18",
      area: "Gulshan",
      district: "Dhaka",
      description: "A modern residential building in Gulshan",
    },
  });

  const building2 = await prisma.building.create({
    data: {
      ownerId: owner.id,
      name: "Hasan Tower",
      holdingNumber: "45/K",
      address: "456 Banani Road",
      ward: "Ward 19",
      area: "Banani",
      district: "Dhaka",
    },
  });

  // ==============================
  // 3. FLOORS
  // ==============================
  const groundFloor = await prisma.floor.create({
    data: { buildingId: building1.id, name: "Ground Floor" },
  });

  const firstFloor = await prisma.floor.create({
    data: { buildingId: building1.id, name: "1st Floor" },
  });

  const secondFloor = await prisma.floor.create({
    data: { buildingId: building1.id, name: "2nd Floor" },
  });

  const b2Ground = await prisma.floor.create({
    data: { buildingId: building2.id, name: "Ground Floor" },
  });

  const b2First = await prisma.floor.create({
    data: { buildingId: building2.id, name: "1st Floor" },
  });

  // ==============================
  // 4. FLATS
  // ==============================
  const flatG1 = await prisma.flat.create({
    data: {
      floorId: groundFloor.id,
      name: "G-1",
      flatNumber: "G1",
      bedrooms: 2,
      bathrooms: 2,
      kitchens: 1,
      balconies: 1,
      area: 850,
      rent: 15000,
      advance: 30000,
      securityDeposit: 15000,
      status: "OCCUPIED",
    },
  });

  const flatF1 = await prisma.flat.create({
    data: {
      floorId: firstFloor.id,
      name: "1-A",
      flatNumber: "1A",
      bedrooms: 3,
      bathrooms: 2,
      kitchens: 1,
      balconies: 2,
      area: 1200,
      rent: 25000,
      advance: 50000,
      securityDeposit: 25000,
      status: "OCCUPIED",
    },
  });

  const flatF2 = await prisma.flat.create({
    data: {
      floorId: secondFloor.id,
      name: "2-A",
      flatNumber: "2A",
      bedrooms: 1,
      bathrooms: 1,
      kitchens: 1,
      balconies: 0,
      area: 600,
      rent: 10000,
      advance: 20000,
      securityDeposit: 10000,
      status: "VACANT",
    },
  });

  const flatB2G = await prisma.flat.create({
    data: {
      floorId: b2Ground.id,
      name: "G-1",
      flatNumber: "G1",
      bedrooms: 2,
      bathrooms: 2,
      kitchens: 1,
      balconies: 1,
      area: 900,
      rent: 18000,
      advance: 36000,
      securityDeposit: 18000,
      status: "OCCUPIED",
    },
  });

  const flatB2F = await prisma.flat.create({
    data: {
      floorId: b2First.id,
      name: "1-A",
      flatNumber: "1A",
      bedrooms: 3,
      bathrooms: 3,
      kitchens: 1,
      balconies: 2,
      area: 1350,
      rent: 30000,
      advance: 60000,
      securityDeposit: 30000,
      status: "OCCUPIED",
    },
  });

  // ==============================
  // 5. TENANTS
  // ==============================
  const t1 = await prisma.tenant.create({
    data: {
      flatId: flatG1.id,
      ownerId: owner.id,
      firstName: "Md.",
      lastName: "Karim",
      phone: "01711111111",
      email: "karim@email.com",
      nid: "1234567890",
      occupation: "Banker",
      office: "Sonali Bank",
      emergencyContact: "01722222222",
      presentAddress: "Gulshan, Dhaka",
      permanentAddress: "Barisal",
      moveInDate: new Date("2024-01-01"),
      status: "ACTIVE",
    },
  });

  const t2 = await prisma.tenant.create({
    data: {
      flatId: flatF1.id,
      ownerId: owner.id,
      firstName: "Abdul",
      lastName: "Baten",
      phone: "01733333333",
      email: "baten@email.com",
      nid: "0987654321",
      occupation: "Engineer",
      office: "BUET",
      emergencyContact: "01744444444",
      presentAddress: "Banani, Dhaka",
      permanentAddress: "Rajshahi",
      moveInDate: new Date("2024-03-01"),
      status: "ACTIVE",
    },
  });

  const t3 = await prisma.tenant.create({
    data: {
      flatId: flatB2G.id,
      ownerId: owner.id,
      firstName: "Shahinur",
      lastName: "Rahman",
      phone: "01755555555",
      email: "shahinur@email.com",
      occupation: "Doctor",
      office: "DMCH",
      moveInDate: new Date("2024-06-01"),
      status: "ACTIVE",
    },
  });

  // ==============================
  // 6. INVOICES + PAYMENTS (last 6 months)
  // ==============================
  const currentYear = 2026;
  const months = [1, 2, 3, 4, 5, 6];

  type FlatRentEntry = { rent: number; flatId: bigint; tenantId?: bigint };

  const flatRents: Record<string, FlatRentEntry> = {
    [flatG1.id.toString()]: { rent: 15000, flatId: flatG1.id, tenantId: t1.id },
    [flatF1.id.toString()]: { rent: 25000, flatId: flatF1.id, tenantId: t2.id },
    [flatB2G.id.toString()]: { rent: 18000, flatId: flatB2G.id, tenantId: t3.id },
    [flatB2F.id.toString()]: { rent: 30000, flatId: flatB2F.id },
  };

  // Bill types the owner collects (configurable in the app)
  const bt = async (data: any) => prisma.billType.create({ data: { ownerId: owner.id, ...data } });
  const btElectricity = await bt({ name: "Electricity", calcMethod: "SLAB", unitLabel: "kWh", sortOrder: 1, demandChargePerKw: 42, vatPercent: 5,
    slabs: { lifeline: { upTo: 50, rate: 4.63 }, steps: [
      { from: 1, to: 75, rate: 5.26 }, { from: 76, to: 200, rate: 8.5 }, { from: 201, to: 300, rate: 9.1 },
      { from: 301, to: 400, rate: 9.62 }, { from: 401, to: 600, rate: 15.01 }, { from: 601, to: null, rate: 17.35 } ] } });
  const btWater = await bt({ name: "Water", calcMethod: "PER_PERSON", rate: 150, unitLabel: "person", sortOrder: 2 });
  const btGas = await bt({ name: "Gas", calcMethod: "FIXED", rate: 1080, sortOrder: 3 });
  const btService = await bt({ name: "Service Charge", calcMethod: "FIXED", rate: 1000, sortOrder: 4 });
  const btGarage = await bt({ name: "Garage", calcMethod: "FIXED", rate: 1500, appliesToAll: false, sortOrder: 5 });
  await prisma.flatCharge.create({ data: { flatId: flatF1.id, billTypeId: btGarage.id, isActive: true } });

  await prisma.$transaction(async (tx) => {
    for (const month of months) {
      for (const [, data] of Object.entries(flatRents)) {
        const electricity = Math.round(data.rent * 0.08);
        const water = Math.round(data.rent * 0.03);
        const gas = Math.round(data.rent * 0.04);
        const serviceCharge = Math.round(data.rent * 0.05);
        const total = data.rent + electricity + water + gas + serviceCharge;

        const isPartial = month === 4 && data.flatId === flatF1.id;
        const isOverdue = month === 2 && data.flatId === flatB2G.id;

        let status: InvoiceStatus = "PAID";
        let paidAmount = total;
        let dueAmount = 0;

        if (month === 6) {
          status = "PENDING";
          paidAmount = 0;
          dueAmount = total;
        } else if (isPartial) {
          status = "PARTIALLY_PAID";
          paidAmount = Math.round(total * 0.6);
          dueAmount = total - paidAmount;
        } else if (isOverdue) {
          status = "OVERDUE";
          paidAmount = 0;
          dueAmount = total;
        }

        const invoice = await tx.invoice.create({
          data: {
            flatId: data.flatId,
            tenantId: data.tenantId ?? null,
            ownerId: owner.id,
            month,
            year: currentYear,
            rent: data.rent,
            previousDue: 0,
            discount: 0,
            fine: 0,
            totalAmount: total,
            paidAmount,
            dueAmount,
            status,
            dueDate: new Date(currentYear, month - 1, 10),
            items: {
              create: [
                { label: "Rent", amount: data.rent, sortOrder: 0 },
                { label: "Electricity", billTypeId: btElectricity.id, amount: electricity, sortOrder: 1 },
                { label: "Water", billTypeId: btWater.id, amount: water, sortOrder: 2 },
                { label: "Gas", billTypeId: btGas.id, amount: gas, sortOrder: 3 },
                { label: "Service Charge", billTypeId: btService.id, amount: serviceCharge, sortOrder: 4 },
              ],
            },
          },
        });

        if (paidAmount > 0) {
          await tx.payment.create({
            data: {
              invoiceId: invoice.id,
              ownerId: owner.id,
              amount: paidAmount,
              method: status === "PAID" ? "CASH" : "BKASH",
              transactionId:
                status === "PAID"
                  ? `TXN${month}${data.flatId.toString().slice(0, 4)}`
                  : null,
              collector: status === "PAID" ? "Rafiq Hasan" : null,
              date: new Date(currentYear, month - 1, Math.floor(Math.random() * 25) + 1),
            },
          });
        }
      }
    }
  });

  // ==============================
  // 7. EXPENSES
  // ==============================
  const expenseData = [
    { category: "SECURITY" as ExpenseCategory, amount: 8000, date: new Date("2026-01-05") },
    { category: "CLEANING" as ExpenseCategory, amount: 3000, date: new Date("2026-01-05") },
    { category: "LIFT" as ExpenseCategory, amount: 5000, date: new Date("2026-01-15") },
    { category: "SECURITY" as ExpenseCategory, amount: 8000, date: new Date("2026-02-05") },
    { category: "CLEANING" as ExpenseCategory, amount: 3000, date: new Date("2026-02-05") },
    { category: "REPAIRS" as ExpenseCategory, amount: 12000, date: new Date("2026-02-20") },
    { category: "SECURITY" as ExpenseCategory, amount: 8000, date: new Date("2026-03-05") },
    { category: "CLEANING" as ExpenseCategory, amount: 3000, date: new Date("2026-03-05") },
    { category: "MAINTENANCE" as ExpenseCategory, amount: 6000, date: new Date("2026-03-10") },
    { category: "SECURITY" as ExpenseCategory, amount: 8000, date: new Date("2026-04-05") },
    { category: "CLEANING" as ExpenseCategory, amount: 3000, date: new Date("2026-04-05") },
    { category: "COMMON_ELECTRICITY" as ExpenseCategory, amount: 4500, date: new Date("2026-04-10") },
    { category: "SECURITY" as ExpenseCategory, amount: 8000, date: new Date("2026-05-05") },
    { category: "CLEANING" as ExpenseCategory, amount: 3000, date: new Date("2026-05-05") },
    { category: "MISC" as ExpenseCategory, amount: 2000, date: new Date("2026-05-20") },
    { category: "SECURITY" as ExpenseCategory, amount: 8000, date: new Date("2026-06-05") },
    { category: "CLEANING" as ExpenseCategory, amount: 3000, date: new Date("2026-06-05") },
  ];

  await prisma.$transaction(async (tx) => {
    for (const exp of expenseData) {
      await tx.expense.create({
        data: {
          ownerId: owner.id,
          buildingId: building1.id,
          category: exp.category,
          amount: exp.amount,
          description: `${exp.category} expense for ${exp.date.toLocaleDateString("en-US", { month: "long", year: "numeric" })}`,
          date: exp.date,
        },
      });
    }
  });

  // ==============================
  // 8. ELECTRICITY METER READINGS
  // ==============================
  await prisma.billEntry.createMany({
    data: [
      { flatId: flatF1.id, billTypeId: btElectricity.id, month: 5, year: 2026, previousReading: 2100, currentReading: 2450 },
      { flatId: flatF1.id, billTypeId: btElectricity.id, month: 6, year: 2026, previousReading: 2450, currentReading: 2800 },
    ],
  });

  console.log("✅ Seed complete!");
  console.log(`   Owners: 2`);
  console.log(`   Buildings: 2`);
  console.log(`   Floors: 5`);
  console.log(`   Flats: 4`);
  console.log(`   Tenants: 3`);
  console.log(`   Invoices: ${months.length * Object.keys(flatRents).length}`);
  console.log(`   Expenses: ${expenseData.length}`);
  console.log(`   Demo owner login: owner@demo.com / Test1234`);
  console.log(`   Demo owner2 login: owner2@demo.com / Test1234`);

  console.log("\n📌 Summary for Dashboard:");
  console.log("   Total Buildings: 2");
  console.log("   Total Flats: 4");
  console.log("   Occupied: 3");
  console.log("   Vacant: 1");
  console.log("   Vacancy Rate: 25%");
  console.log("   Current Month Revenue ~88,000");
  console.log("   Total Revenue (6 months): ~528,000");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
