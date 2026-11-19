import { PrismaClient, Prisma, InvoiceStatus, ExpenseCategory } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";
import { formatReceiptNo } from "../src/shared/notify/collect";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // Clean existing data in dependency order
  await prisma.notification.deleteMany();
  await prisma.payment.deleteMany();
  await prisma.cashHandover.deleteMany();
  await prisma.orgCounter.deleteMany();
  await prisma.depositEntry.deleteMany();
  await prisma.rateRevision.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.invoiceItem.deleteMany();
  await prisma.billEntry.deleteMany();
  await prisma.flatCharge.deleteMany();
  await prisma.billType.deleteMany();
  await prisma.agreement.deleteMany();
  await prisma.tenant.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.flat.deleteMany();
  await prisma.floor.deleteMany();
  await prisma.building.deleteMany();
  await prisma.asset.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.ownerProfile.deleteMany();
  await prisma.membership.deleteMany();
  await prisma.organization.deleteMany();
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
      status: "ACTIVE",
      emailVerified: true,
    },
  });

  // Workspaces: each owner runs one organisation; org 1 also has staff (phase 1).
  const settings = { dueDay: 10, noticeMonths: 2 };
  const org = await prisma.organization.create({ data: { name: "Hasan Properties", settings } });
  const org2 = await prisma.organization.create({ data: { name: "Ahmed Residences", settings } });
  const staff = (email: string, firstName: string, lastName: string) =>
    prisma.user.create({ data: { email, password, firstName, lastName, status: "ACTIVE", emailVerified: true } });
  const manager = await staff("manager@demo.com", "Selina", "Akter");
  const caretaker = await staff("caretaker@demo.com", "Rafiq", "Mia");
  await prisma.membership.createMany({
    data: [
      { userId: owner.id, orgId: org.id, role: "OWNER" },
      { userId: owner2.id, orgId: org2.id, role: "OWNER" },
      { userId: manager.id, orgId: org.id, role: "MANAGER" },
      { userId: caretaker.id, orgId: org.id, role: "CARETAKER" },
    ],
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
      orgId: org.id,
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
      orgId: org.id,
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
  // every unit is an Asset (agreements and invoices point at the asset)
  const unit = async (data: Omit<Prisma.FlatUncheckedCreateInput, "assetId">) => {
    const asset = await prisma.asset.create({ data: { orgId: org.id, kind: "UNIT" } });
    return prisma.flat.create({ data: { ...data, assetId: asset.id } });
  };

  const flatG1 = await unit({
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
  });

  const flatF1 = await unit({
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
  });

  const flatF2 = await unit({
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
  });

  const flatB2G = await unit({
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
  });

  const flatB2F = await unit({
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
  });

  // ==============================
  // 5. TENANTS
  // ==============================
  const t1 = await prisma.tenant.create({
    data: {
      orgId: org.id,
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
    },
  });

  const t2 = await prisma.tenant.create({
    data: {
      orgId: org.id,
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
    },
  });

  const t3 = await prisma.tenant.create({
    data: {
      orgId: org.id,
      firstName: "Shahinur",
      lastName: "Rahman",
      phone: "01755555555",
      email: "shahinur@email.com",
      occupation: "Doctor",
      office: "DMCH",
    },
  });

  const t4 = await prisma.tenant.create({
    data: { orgId: org.id, firstName: "Nusrat", lastName: "Jahan", phone: "01766666666", occupation: "Architect", members: 3 },
  });

  // Agreements: rent, start date and the deposit actually received (the flat keeps its asking terms)
  const agree = (flat: { assetId: bigint; rent: Prisma.Decimal }, tenantId: bigint, start: string, deposit: number) =>
    prisma.agreement.create({
      data: {
        orgId: org.id, assetId: flat.assetId, tenantId, rate: flat.rent, startDate: new Date(start + "T00:00:00Z"),
        status: "ACTIVE", bankOnly: Number(flat.rent) > 25000, noticeDays: 60, dueDay: 10,
        deposits: { create: { type: "RECEIVED", amount: deposit, date: new Date(start + "T00:00:00Z"), note: "Advance + security at signing" } },
      },
    });
  const a1 = await agree(flatG1, t1.id, "2024-01-01", 45000);
  const a2 = await agree(flatF1, t2.id, "2024-03-01", 75000);
  const a3 = await agree(flatB2G, t3.id, "2024-06-01", 54000);
  const a4 = await agree(flatB2F, t4.id, "2025-07-01", 60000); // ৳30,000 rent: bank-only (NBR)

  // ==============================
  // 6. INVOICES + PAYMENTS (last 6 months)
  // ==============================
  const currentYear = 2026;
  const months = [1, 2, 3, 4, 5, 6];

  type FlatRentEntry = { rent: number; flatId: bigint; tenantId: bigint; agreementId: bigint; assetId: bigint };

  const flatRents: Record<string, FlatRentEntry> = {
    [flatG1.id.toString()]: { rent: 15000, flatId: flatG1.id, tenantId: t1.id, agreementId: a1.id, assetId: flatG1.assetId },
    [flatF1.id.toString()]: { rent: 25000, flatId: flatF1.id, tenantId: t2.id, agreementId: a2.id, assetId: flatF1.assetId },
    [flatB2G.id.toString()]: { rent: 18000, flatId: flatB2G.id, tenantId: t3.id, agreementId: a3.id, assetId: flatB2G.assetId },
    [flatB2F.id.toString()]: { rent: 30000, flatId: flatB2F.id, tenantId: t4.id, agreementId: a4.id, assetId: flatB2F.assetId },
  };

  // Bill types the owner collects (configurable in the app)
  const bt = async (data: any) => prisma.billType.create({ data: { orgId: org.id, ...data } });
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
            tenantId: data.tenantId,
            agreementId: data.agreementId,
            assetId: data.assetId,
            orgId: org.id,
            month,
            year: currentYear,
            periodStart: new Date(Date.UTC(currentYear, month - 1, 1)),
            periodEnd: new Date(Date.UTC(currentYear, month, 0)),
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
              orgId: org.id,
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

  // Receipts: number every payment in date order (as the app does), and let the
  // caretaker hold the latest month's cash so the Cash handover screen has something to settle.
  const pays = await prisma.payment.findMany({ where: { orgId: org.id }, orderBy: [{ date: "asc" }, { id: "asc" }] });
  const caretakerMember = await prisma.membership.findFirstOrThrow({ where: { userId: caretaker.id, orgId: org.id } });
  const lastPaidMonth = Math.max(...pays.map((p) => p.date.getMonth()));
  for (const [i, p] of pays.entries()) {
    const lastMonth = p.date.getMonth() === lastPaidMonth;
    await prisma.payment.update({
      where: { id: p.id },
      data: {
        receiptNo: formatReceiptNo(p.date.getFullYear(), i + 1),
        shareToken: randomBytes(24).toString("base64url"),
        ...(lastMonth && { method: "CASH", collectedById: caretakerMember.id, collector: null }),
      },
    });
  }
  await prisma.orgCounter.create({ data: { orgId: org.id, key: `receipt:${currentYear}`, value: pays.length } });

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
          orgId: org.id,
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
  console.log(`   Tenants: 4 (each with an agreement and deposit)`);
  console.log(`   Invoices: ${months.length * Object.keys(flatRents).length}`);
  console.log(`   Expenses: ${expenseData.length}`);
  console.log(`   Demo owner login: owner@demo.com / Test1234`);
  console.log(`   Demo owner2 login: owner2@demo.com / Test1234`);
  console.log(`   Staff in org 1: manager@demo.com, caretaker@demo.com / Test1234`);

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
