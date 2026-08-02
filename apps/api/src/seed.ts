import { hash } from "@node-rs/argon2";
import {
  CommentVisibility,
  KbArticleStatus,
  PrismaClient,
  RoleScope,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  console.log("==> Seeding SupportDesk Enterprise v1.0.0 Demo Data...");

  // Password hash for 'Password123!' using Argon2id
  const passwordHash = await hash("Password123!", {
    algorithm: 2, // argon2id
    memoryCost: 65536,
    outputLen: 32,
    parallelism: 1,
    timeCost: 3,
  });

  // 1. Create Demo Tenant
  const tenant = await prisma.tenant.upsert({
    where: { slug: "acme" },
    update: { name: "Acme Corporation", state: "ACTIVE" },
    create: {
      name: "Acme Corporation",
      slug: "acme",
      state: "ACTIVE",
      defaultLocale: "en-US",
      defaultTimeZone: "UTC",
      registrationEnabled: true,
    },
  });
  console.log(`✓ Tenant created: ${tenant.name} (${tenant.id})`);

  // 2. Fetch all system permissions from DB
  const permissions = await prisma.permission.findMany();
  console.log(`✓ Loaded ${permissions.length} system permissions.`);

  // 3. Create Tenant Admin Role & assign all permissions
  const adminRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "tenant_admin" } },
    update: { name: "Tenant Administrator", isSystem: true },
    create: {
      tenantId: tenant.id,
      key: "tenant_admin",
      name: "Tenant Administrator",
      description: "Full administrative access across tenant resources",
      isSystem: true,
    },
  });

  for (const perm of permissions) {
    await prisma.rolePermission.upsert({
      where: {
        tenantId_roleId_permissionId_scope: {
          tenantId: tenant.id,
          roleId: adminRole.id,
          permissionId: perm.id,
          scope: RoleScope.TENANT,
        },
      },
      update: {},
      create: {
        tenantId: tenant.id,
        roleId: adminRole.id,
        permissionId: perm.id,
        scope: RoleScope.TENANT,
      },
    });
  }
  console.log(`✓ Created Tenant Admin role with ${permissions.length} permissions.`);

  // 4. Create Agent Role & assign operational permissions
  const agentRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "agent" } },
    update: { name: "Support Agent", isSystem: true },
    create: {
      tenantId: tenant.id,
      key: "agent",
      name: "Support Agent",
      description: "Support desk agent operational role for managing tickets and assets",
      isSystem: true,
    },
  });

  const agentPermKeys = [
    "ticket.read",
    "ticket.create",
    "ticket.update",
    "ticket.assign",
    "comment.read",
    "comment.create",
    "attachment.read",
    "attachment.create",
    "kb.read",
    "kb.create",
    "asset.read",
    "asset.update",
    "catalog.read",
  ];

  for (const permKey of agentPermKeys) {
    const perm = permissions.find((p) => p.key === permKey);
    if (perm) {
      await prisma.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionId_scope: {
            tenantId: tenant.id,
            roleId: agentRole.id,
            permissionId: perm.id,
            scope: RoleScope.TENANT,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          roleId: agentRole.id,
          permissionId: perm.id,
          scope: RoleScope.TENANT,
        },
      });
    }
  }
  console.log(`✓ Created Support Agent role.`);

  // 5. Create Requester Role
  const requesterRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "requester" } },
    update: { name: "End User Requester", isSystem: true },
    create: {
      tenantId: tenant.id,
      key: "requester",
      name: "End User Requester",
      description: "Standard end-user for submitting and tracking support requests",
      isSystem: true,
    },
  });

  const requesterPermKeys = [
    "ticket.read",
    "ticket.create",
    "comment.read",
    "comment.create",
    "attachment.read",
    "attachment.create",
    "kb.read",
    "catalog.read",
    "catalog.request",
  ];

  for (const permKey of requesterPermKeys) {
    const perm = permissions.find((p) => p.key === permKey);
    if (perm) {
      await prisma.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionId_scope: {
            tenantId: tenant.id,
            roleId: requesterRole.id,
            permissionId: perm.id,
            scope: RoleScope.OWN,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          roleId: requesterRole.id,
          permissionId: perm.id,
          scope: RoleScope.OWN,
        },
      });
    }
  }
  console.log(`✓ Created Requester role.`);

  // 6. Create Users
  const usersToSeed = [
    {
      email: "superadmin@supportdesk.io",
      name: "Super Admin",
      roleId: adminRole.id,
    },
    {
      email: "admin@acme.com",
      name: "Acme Tenant Admin",
      roleId: adminRole.id,
    },
    {
      email: "agent@acme.com",
      name: "Sarah Support Agent",
      roleId: agentRole.id,
    },
    {
      email: "user@acme.com",
      name: "John User Requester",
      roleId: requesterRole.id,
    },
  ];

  for (const u of usersToSeed) {
    const emailNormalized = u.email.toLowerCase();
    const user = await prisma.user.upsert({
      where: { emailNormalized },
      update: {
        state: "ACTIVE",
        passwordHash,
        emailVerifiedAt: new Date(),
      },
      create: {
        email: u.email,
        emailNormalized,
        passwordHash,
        state: "ACTIVE",
        emailVerifiedAt: new Date(),
        profile: {
          create: {
            displayName: u.name,
            firstName: u.name.split(" ")[0],
            lastName: u.name.split(" ").slice(1).join(" ") || "User",
          },
        },
      },
    });

    // Assign Role
    await prisma.userRole.upsert({
      where: {
        tenantId_userId_roleId: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: u.roleId,
        },
      },
      update: { revokedAt: null },
      create: {
        tenantId: tenant.id,
        userId: user.id,
        roleId: u.roleId,
      },
    });
    console.log(`✓ Seeded User: ${u.email} (${u.name})`);
  }

  // 7. Seed Sample Ticket
  const requesterUser = await prisma.user.findUnique({
    where: { emailNormalized: "user@acme.com" },
  });
  const agentUser = await prisma.user.findUnique({
    where: { emailNormalized: "agent@acme.com" },
  });

  if (requesterUser && agentUser) {
    const existingTicket = await prisma.ticket.findFirst({
      where: { tenantId: tenant.id, publicRef: "TKT-1001" },
    });

    if (!existingTicket) {
      const ticket = await prisma.ticket.create({
        data: {
          tenantId: tenant.id,
          publicRef: "TKT-1001",
          title: "High Memory Utilization Alert on DB Cluster",
          description: "Database memory usage reached 92% sustained over 15 minutes.",
          status: TicketStatus.OPEN,
          priority: TicketPriority.HIGH,
          type: TicketType.INCIDENT,
          channel: TicketChannel.WEB,
          requesterUserId: requesterUser.id,
          assigneeUserId: agentUser.id,
        },
      });

      await prisma.comment.create({
        data: {
          tenantId: tenant.id,
          ticketId: ticket.id,
          authorUserId: agentUser.id,
          body: "Investigating query buffer cache pool sizing.",
          visibility: CommentVisibility.PUBLIC,
        },
      });

      console.log(`✓ Seeded Sample Ticket: TKT-1001 (${ticket.id})`);
    }
  }

  // 8. Seed Sample Knowledge Base Article
  const kbCategory = await prisma.kbCategory.upsert({
    where: { tenantId_slug: { tenantId: tenant.id, slug: "getting-started" } },
    update: {},
    create: {
      tenantId: tenant.id,
      name: "Getting Started Guides",
      slug: "getting-started",
      description: "Helpful guides for new platform users",
    },
  });

  if (requesterUser) {
    await prisma.kbArticle.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "sso-password-reset" } },
      update: {},
      create: {
        tenantId: tenant.id,
        categoryId: kbCategory.id,
        authorId: requesterUser.id,
        title: "How to Reset Your Corporate SSO Password",
        slug: "sso-password-reset",
        summary: "Step-by-step instructions to self-serve password reset via Okta / Azure AD.",
        content:
          "### Password Reset Instructions\n1. Visit the portal\n2. Click Forgot Password\n3. Complete OTP challenge.",
        status: KbArticleStatus.PUBLISHED,
        publishedAt: new Date(),
      },
    });
    console.log(`✓ Seeded Sample KB Article: "How to Reset Your Corporate SSO Password"`);
  }

  console.log("\n==> DEMO DATA SEEDING COMPLETE! <==");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
