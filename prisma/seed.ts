import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { ADDON_REGISTRY } from "../src/lib/addon-registry";

const prisma = new PrismaClient();

function todayAt(hour: number, minute = 0): Date {
  const d = new Date();
  d.setHours(hour, minute, 0, 0);
  return d;
}

function daysAgo(days: number, hour = 10): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, 0, 0, 0);
  return d;
}

async function main() {
  console.log("🌱 A semear a base de dados...");

  // Limpar tudo
  await prisma.cascadeOffer.deleteMany();
  await prisma.waitlistEntry.deleteMany();
  await prisma.appointment.deleteMany();
  await prisma.addonDefinition.deleteMany();
  await prisma.planDefinition.deleteMany();
  await prisma.client.deleteMany();
  await prisma.service.deleteMany();
  await prisma.messageLog.deleteMany();
  await prisma.settings.deleteMany();
  await prisma.subscription.deleteMany();
  await prisma.user.deleteMany();

  // Planos e add-ons
  await prisma.planDefinition.create({
    data: {
      key: "BASE",
      name: "Plano Base",
      description: "Acesso completo ao calendário, clientes e notificações WhatsApp",
      price: 9.99,
      features: JSON.stringify(["Marcações e calendário", "Notificações WhatsApp", "Lista de espera com cascata"]),
    },
  });
  await prisma.addonDefinition.createMany({
    data: ADDON_REGISTRY.map((a) => ({
      key: a.key,
      name: a.defaultName,
      description: a.defaultDescription,
      price: a.defaultPrice,
    })),
  });

  // Admin
  const adminPw = await bcrypt.hash("admin123", 10);
  await prisma.user.create({
    data: {
      email: "admin@example.com",
      password: adminPw,
      name: "Administrador",
      role: "admin",
    },
  });

  // Demo user (cabeleireiro)
  const demoPw = await bcrypt.hash("demo123", 10);
  const demo = await prisma.user.create({
    data: {
      email: "demo@example.com",
      password: demoPw,
      name: "Salão Demo",
      role: "user",
      subscription: { create: { plan: "BASE", addons: "[]", status: "active", renewalType: "monthly", paymentStatus: "paid" } },
      settings: {
        create: {
          salonName: "O Meu Salão",
          workdayStart: "09:00",
          workdayEnd: "19:00",
          lunchStart: "12:30",
          lunchEnd: "14:00",
          cascadeWaitMinutes: 30,
          reminderHoursBefore: 24,
        },
      },
    },
  });

  const uid = demo.id;

  // Serviços
  const corteM = await prisma.service.create({ data: { userId: uid, name: "Corte mulher", durationMin: 45, category: "corte" } });
  const corteH = await prisma.service.create({ data: { userId: uid, name: "Corte homem", durationMin: 30, category: "corte" } });
  const coloracao = await prisma.service.create({ data: { userId: uid, name: "Coloração + corte", durationMin: 90, category: "coloracao" } });
  const brushing = await prisma.service.create({ data: { userId: uid, name: "Brushing", durationMin: 30, category: "rapido" } });
  await prisma.service.create({ data: { userId: uid, name: "Aparar barba", durationMin: 15, category: "barba" } });
  await prisma.service.create({ data: { userId: uid, name: "Retoque de franja", durationMin: 15, category: "rapido" } });
  await prisma.service.create({ data: { userId: uid, name: "Penteado", durationMin: 45, category: "rapido" } });

  // Clientes
  const maria = await prisma.client.create({ data: { userId: uid, name: "Maria Silva", phone: "+351912345001", email: "maria.silva@example.com", customerSince: daysAgo(400) } });
  const joao = await prisma.client.create({ data: { userId: uid, name: "João Pereira", phone: "+351912345002", customerSince: daysAgo(200), notes: "Prefere chá. Alérgico a amoníaco." } });
  const antonio = await prisma.client.create({ data: { userId: uid, name: "António Costa", phone: "+351912345003", customerSince: daysAgo(60) } });
  const claudia = await prisma.client.create({ data: { userId: uid, name: "Cláudia Mendes", phone: "+351912345004", email: "claudia.m@example.com", customerSince: daysAgo(150) } });
  const sofia = await prisma.client.create({ data: { userId: uid, name: "Sofia Marques", phone: "+351912345005", birthday: new Date(new Date().getFullYear(), new Date().getMonth(), new Date().getDate()), customerSince: daysAgo(800) } });
  const ines = await prisma.client.create({ data: { userId: uid, name: "Inês Almeida", phone: "+351912345006", customerSince: daysAgo(100) } });
  const pedro = await prisma.client.create({ data: { userId: uid, name: "Pedro Santos", phone: "+351912345007", customerSince: daysAgo(30) } });
  const teresa = await prisma.client.create({ data: { userId: uid, name: "Teresa Lopes", phone: "+351912345008", customerSince: daysAgo(500) } });

  // Marcações de hoje
  await prisma.appointment.create({ data: { userId: uid, clientId: maria.id, serviceId: corteM.id, startsAt: todayAt(9, 30), endsAt: todayAt(10, 15), status: "done" } });
  await prisma.appointment.create({ data: { userId: uid, clientId: joao.id, serviceId: coloracao.id, startsAt: todayAt(11, 0), endsAt: todayAt(12, 30), status: "confirmed" } });
  await prisma.appointment.create({ data: { userId: uid, clientId: antonio.id, serviceId: corteH.id, startsAt: todayAt(14, 30), endsAt: todayAt(15, 0), status: "pending" } });
  await prisma.appointment.create({ data: { userId: uid, clientId: claudia.id, serviceId: brushing.id, startsAt: todayAt(16, 0), endsAt: todayAt(16, 30), status: "confirmed" } });

  // Marcações amanhã
  const tmw = (h: number, m = 0) => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(h, m, 0, 0); return d; };
  await prisma.appointment.create({ data: { userId: uid, clientId: pedro.id, serviceId: corteH.id, startsAt: tmw(10), endsAt: tmw(10, 30), status: "confirmed" } });
  await prisma.appointment.create({ data: { userId: uid, clientId: teresa.id, serviceId: corteM.id, startsAt: tmw(11), endsAt: tmw(11, 45), status: "confirmed" } });

  // Histórico
  await prisma.appointment.create({ data: { userId: uid, clientId: maria.id, serviceId: corteM.id, startsAt: daysAgo(30, 14), endsAt: daysAgo(30, 15), status: "done" } });
  await prisma.appointment.create({ data: { userId: uid, clientId: maria.id, serviceId: corteM.id, startsAt: daysAgo(60, 16), endsAt: daysAgo(60, 17), status: "done" } });

  // Lista de espera
  await prisma.waitlistEntry.create({ data: { userId: uid, clientId: ines.id, serviceId: coloracao.id, preferences: JSON.stringify({ timeOfDay: "afternoon", weekdays: ["mon","tue","wed","thu","fri"] }) } });
  await prisma.waitlistEntry.create({ data: { userId: uid, clientId: pedro.id, serviceId: corteH.id, preferences: JSON.stringify({ timeOfDay: "any", weekdays: ["any"] }) } });
  await prisma.waitlistEntry.create({ data: { userId: uid, clientId: teresa.id, serviceId: brushing.id, preferences: JSON.stringify({ timeOfDay: "morning", weekdays: ["fri","sat"] }) } });

  console.log("✓ Base de dados pronta.");
  console.log("   Admin:    admin@example.com / admin123");
  console.log("   Demo:     demo@example.com  / demo123");
  console.log("   - 7 serviços, 8 clientes, 4 marcações hoje");
  console.log("   - Sofia Marques faz anos hoje");
  console.log("   - 3 entradas em lista de espera");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
