import { hash } from "@node-rs/argon2";
import {
  AssetLifecycleState,
  AuditOutcome,
  CommentVisibility,
  ConfigPublicationState,
  KbArticleStatus,
  PrismaClient,
  RoleScope,
  ServiceApprovalMode,
  ServiceKind,
  TicketChannel,
  TicketPriority,
  TicketStatus,
  TicketType,
} from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Platform-scoped permissions granted only to the Platform Administrator
 * elevation role, never to the Tenant Administrator role.
 */
const platformOnlyAdminPermissions = [
  "admin.tenant.create",
  "admin.tenant.lifecycle",
  "admin.global.read",
  "admin.global.update",
  "admin.feature_flag.manage",
];

function createRandom(seed = 42) {
  let s = seed;
  return function () {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const random = createRandom(12345);

function randomItem<T>(arr: T[]): T {
  return arr[Math.floor(random() * arr.length)] as T;
}

function randomInt(min: number, max: number): number {
  return Math.floor(random() * (max - min + 1)) + min;
}

function randomDate(start: Date, end: Date): Date {
  return new Date(start.getTime() + random() * (end.getTime() - start.getTime()));
}

async function main() {
  console.log("🚀 Starting Enterprise Demo Data Seed for SupportDesk v1.0.0...");
  const startTime = Date.now();

  // 1. Password Hash for 'Password123!'
  const passwordHash = await hash("Password123!", {
    algorithm: 2,
    memoryCost: 65536,
    outputLen: 32,
    parallelism: 1,
    timeCost: 3,
  });

  // 2. Tenant Setup
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
  console.log(`✓ Tenant verified: ${tenant.name} (${tenant.id})`);

  // 3. Permissions & System Roles
  const permissions = await prisma.permission.findMany();
  console.log(`✓ Loaded ${permissions.length} system permissions.`);

  const adminRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "tenant_admin" } },
    update: { name: "Tenant Administrator" },
    create: {
      tenantId: tenant.id,
      key: "tenant_admin",
      name: "Tenant Administrator",
      description: "Full tenant administration access",
      isSystem: true,
    },
  });

  for (const perm of permissions) {
    if (platformOnlyAdminPermissions.includes(perm.key)) {
      await prisma.rolePermission.deleteMany({
        where: { roleId: adminRole.id, permissionId: perm.id },
      });
      continue;
    }
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

  const platformAdminRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "platform_admin" } },
    update: { name: "Platform Administrator" },
    create: {
      tenantId: tenant.id,
      key: "platform_admin",
      name: "Platform Administrator",
      description: "Platform-level operator elevation (tenant provisioning and lifecycle)",
      isSystem: true,
    },
  });

  for (const permKey of platformOnlyAdminPermissions) {
    const perm = permissions.find((p) => p.key === permKey);
    if (perm) {
      await prisma.rolePermission.upsert({
        where: {
          tenantId_roleId_permissionId_scope: {
            tenantId: tenant.id,
            roleId: platformAdminRole.id,
            permissionId: perm.id,
            scope: RoleScope.PLATFORM,
          },
        },
        update: {},
        create: {
          tenantId: tenant.id,
          roleId: platformAdminRole.id,
          permissionId: perm.id,
          scope: RoleScope.PLATFORM,
        },
      });
    }
  }

  const agentRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "agent" } },
    update: { name: "Support Agent" },
    create: {
      tenantId: tenant.id,
      key: "agent",
      name: "Support Agent",
      description: "Operational support agent role",
      isSystem: true,
    },
  });

  const agentPermKeys = [
    "ticket.read",
    "ticket.create",
    "ticket.update",
    "ticket.assign",
    "ticket.transition",
    "ticket.comment.read",
    "ticket.comment.internal.read",
    "ticket.comment.public.create",
    "ticket.comment.internal.create",
    "ticket.comment.update",
    "ticket.attachment.read",
    "ticket.attachment.create",
    "ticket.attachment.delete",
    "sla.read",
    "kb.category.read",
    "kb.category.create",
    "kb.category.update",
    "kb.article.read",
    "kb.article.read_internal",
    "kb.article.create",
    "kb.article.update",
    "kb.article.publish",
    "kb.article.archive",
    "kb.article.link_ticket",
    "asset.read",
    "asset.update",
    "asset.create",
    "asset.delete",
    "asset.transition",
    "asset.assign",
    "asset.unassign",
    "asset.type.read",
    "asset.category.read",
    "asset.location.read",
    "asset.relationship.create",
    "asset.relationship.delete",
    "asset.history.read",
    "asset.ticket.link",
    "asset.ticket.unlink",
    "asset.kb.link",
    "asset.attachment.create",
    "asset.attachment.read",
    "asset.attachment.delete",
    "catalog.category.read",
    "catalog.category.create",
    "catalog.category.update",
    "catalog.service.read",
    "catalog.service.create",
    "catalog.service.update",
    "catalog.service.publish",
    "catalog.form.read",
    "catalog.form.update",
    "catalog.template.read",
    "catalog.template.create",
    "catalog.template.update",
    "catalog.request.create",
    "catalog.request.read",
    "catalog.request.read_all",
    "catalog.request.update",
    "catalog.request.cancel",
    "catalog.request.fulfill",
    "catalog.request.generate_ticket",
    "catalog.request.complete",
    "catalog.approval.decide",
    "catalog.request.attachment.create",
    "catalog.request.attachment.delete",
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

  const requesterRole = await prisma.role.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "requester" } },
    update: { name: "End User Requester" },
    create: {
      tenantId: tenant.id,
      key: "requester",
      name: "End User Requester",
      description: "Standard end user requester role",
      isSystem: true,
    },
  });

  const requesterPermKeys = [
    "ticket.read",
    "ticket.create",
    "ticket.update",
    "ticket.transition",
    "ticket.comment.read",
    "ticket.comment.public.create",
    "ticket.comment.update",
    "ticket.attachment.read",
    "ticket.attachment.create",
    "ticket.attachment.delete",
    "kb.category.read",
    "kb.article.read",
    "catalog.category.read",
    "catalog.service.read",
    "catalog.form.read",
    "catalog.template.read",
    "catalog.request.create",
    "catalog.request.read",
    "catalog.request.update",
    "catalog.request.cancel",
    "catalog.request.attachment.create",
    "catalog.request.attachment.delete",
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

  // 4. Seed Users (55 Total: 5 Admins, 20 Agents, 30 Requesters)
  console.log("👤 Seeding 55 enterprise users...");

  const userConfigs = [
    { email: "superadmin@supportdesk.io", name: "Super Admin", roleId: adminRole.id },
    { email: "admin@acme.com", name: "Acme Tenant Admin", roleId: adminRole.id },
    { email: "admin.security@acme.com", name: "Marcus Vance", roleId: adminRole.id },
    { email: "admin.ops@acme.com", name: "Elena Rostova", roleId: adminRole.id },
    { email: "admin.cloud@acme.com", name: "David Chen", roleId: adminRole.id },
    { email: "agent@acme.com", name: "Acme Support Agent", roleId: agentRole.id },
    { email: "user@acme.com", name: "Acme Requester", roleId: requesterRole.id },
  ];

  const agentNames = [
    "Sarah Support Agent",
    "Alex Mercer",
    "Jessica Taylor",
    "Michael Rodriguez",
    "Emily Watson",
    "James Wilson",
    "Sophia Martinez",
    "Daniel Kim",
    "Olivia Brown",
    "William Davies",
    "Ava Thomas",
    "Benjamin Jackson",
    "Charlotte White",
    "Ethan Harris",
    "Amelia Martin",
    "Lucas Thompson",
    "Mia Garcia",
    "Henry Martinez",
    "Harper Robinson",
    "Alexander Clark",
  ];
  agentNames.forEach((name, i) => {
    const parts = name.split(" ");
    const firstName = parts[0] ? parts[0].toLowerCase() : `agent${i}`;
    userConfigs.push({
      email: `agent.${firstName}${i + 1}@acme.com`,
      name,
      roleId: agentRole.id,
    });
  });

  const requesterNames = [
    "John User Requester",
    "Robert Johnson",
    "Patricia Williams",
    "Jennifer Jones",
    "Linda Miller",
    "Elizabeth Davis",
    "Barbara Lopez",
    "Susan Gonzalez",
    "Jessica Wilson",
    "Karen Anderson",
    "Nancy Thomas",
    "Lisa Taylor",
    "Margaret Moore",
    "Sandra Jackson",
    "Ashley Martin",
    "Kimberly Lee",
    "Emily Perez",
    "Donna Thompson",
    "Michelle White",
    "Carol Harris",
    "Amanda Sanchez",
    "Melissa Clark",
    "Deborah Ramirez",
    "Stephanie Lewis",
    "Rebecca Robinson",
    "Laura Walker",
    "Sharon Young",
    "Cynthia Allen",
    "Kathleen King",
    "Amy Wright",
  ];
  requesterNames.forEach((name, i) => {
    const parts = name.split(" ");
    const firstName = parts[0] ? parts[0].toLowerCase() : `user${i}`;
    userConfigs.push({
      email: `user.${firstName}${i + 1}@acme.com`,
      name,
      roleId: requesterRole.id,
    });
  });

  const createdUserIds: string[] = [];
  const createdAgentIds: string[] = [];
  const createdRequesterIds: string[] = [];

  for (const u of userConfigs) {
    const emailNormalized = u.email.toLowerCase();
    const parts = u.name.split(" ");
    const firstName = parts[0] || "User";
    const lastName = parts.slice(1).join(" ") || "User";

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
            firstName,
            lastName,
          },
        },
      },
    });

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

    if (u.email === "superadmin@supportdesk.io") {
      await prisma.userRole.upsert({
        where: {
          tenantId_userId_roleId: {
            tenantId: tenant.id,
            userId: user.id,
            roleId: platformAdminRole.id,
          },
        },
        update: { revokedAt: null },
        create: {
          tenantId: tenant.id,
          userId: user.id,
          roleId: platformAdminRole.id,
        },
      });
    }

    createdUserIds.push(user.id);
    if (u.roleId === agentRole.id) {
      createdAgentIds.push(user.id);
    } else if (u.roleId === requesterRole.id) {
      createdRequesterIds.push(user.id);
    }
  }
  console.log(
    `✓ Seeded ${createdUserIds.length} users (${createdAgentIds.length} agents, ${createdRequesterIds.length} requesters).`,
  );

  // 5. CMDB Locations, Categories, Types & 105 Assets
  console.log("🖥️  Seeding CMDB Asset Infrastructure (105 Assets)...");

  const locations = await Promise.all([
    prisma.assetLocation.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "San Francisco HQ" } },
      update: {},
      create: { tenantId: tenant.id, name: "San Francisco HQ", description: "Main HQ Office" },
    }),
    prisma.assetLocation.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "London Office" } },
      update: {},
      create: { tenantId: tenant.id, name: "London Office", description: "EMEA Regional Office" },
    }),
    prisma.assetLocation.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "Tokyo Innovation Hub" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "Tokyo Innovation Hub",
        description: "APAC Technology Hub",
      },
    }),
    prisma.assetLocation.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "NYC Financial District" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "NYC Financial District",
        description: "US East Operations",
      },
    }),
    prisma.assetLocation.upsert({
      where: { tenantId_name: { tenantId: tenant.id, name: "AWS Cloud (us-east-1)" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "AWS Cloud (us-east-1)",
        description: "Primary Cloud Data Center",
      },
    }),
  ]);

  const assetCategories = await Promise.all([
    prisma.assetCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "laptops" } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: "laptops",
        name: "Corporate Laptops",
        description: "Portable workstations",
      },
    }),
    prisma.assetCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "servers" } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: "servers",
        name: "Data Center Servers",
        description: "Physical rack servers",
      },
    }),
    prisma.assetCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "networking" } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: "networking",
        name: "Network Infrastructure",
        description: "Routers, switches, firewalls",
      },
    }),
    prisma.assetCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "cloud" } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: "cloud",
        name: "Cloud Compute Nodes",
        description: "AWS EC2 instances & clusters",
      },
    }),
    prisma.assetCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "software" } },
      update: {},
      create: {
        tenantId: tenant.id,
        slug: "software",
        name: "Enterprise Licenses",
        description: "Software seats and licenses",
      },
    }),
  ]);

  const assetTypes = await Promise.all([
    prisma.assetType.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: "macbook-pro-16" } },
      update: {},
      create: {
        tenantId: tenant.id,
        key: "macbook-pro-16",
        name: 'MacBook Pro 16"',
        description: "Apple M3 Max Laptop",
      },
    }),
    prisma.assetType.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: "dell-xps-15" } },
      update: {},
      create: {
        tenantId: tenant.id,
        key: "dell-xps-15",
        name: "Dell XPS 15 Workstation",
        description: "Intel i9 Workstation",
      },
    }),
    prisma.assetType.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: "rack-server" } },
      update: {},
      create: {
        tenantId: tenant.id,
        key: "rack-server",
        name: "PowerEdge R750 Server",
        description: "Dell PowerEdge Rack Server",
      },
    }),
    prisma.assetType.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: "cisco-switch" } },
      update: {},
      create: {
        tenantId: tenant.id,
        key: "cisco-switch",
        name: "Cisco Catalyst Switch 9300",
        description: "48-port Managed Switch",
      },
    }),
    prisma.assetType.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: "aws-ec2" } },
      update: {},
      create: {
        tenantId: tenant.id,
        key: "aws-ec2",
        name: "AWS EC2 Instance",
        description: "r6g.4xlarge compute node",
      },
    }),
  ]);

  const lifecycleStates = [
    AssetLifecycleState.ASSIGNED,
    AssetLifecycleState.ASSIGNED,
    AssetLifecycleState.ASSIGNED,
    AssetLifecycleState.IN_STOCK,
    AssetLifecycleState.IN_REPAIR,
    AssetLifecycleState.RETIRED,
  ];

  const createdAssets: Array<{ id: string; name: string; assetRef: string }> = [];

  for (let i = 1; i <= 105; i++) {
    const assetRef = `AST-${1000 + i}`;
    const assetTag = assetRef;
    const category = randomItem(assetCategories);
    const type = randomItem(assetTypes);
    const location = randomItem(locations);
    const lifecycleState = randomItem(lifecycleStates);
    const assignedUserId =
      lifecycleState === AssetLifecycleState.ASSIGNED ? randomItem(createdUserIds) : null;
    const name = `${type.name} - Unit #${i}`;

    const asset = await prisma.asset.upsert({
      where: { tenantId_assetRef: { tenantId: tenant.id, assetRef } },
      update: { lifecycleState, assignedUserId },
      create: {
        tenantId: tenant.id,
        assetRef,
        assetTag,
        name,
        assetTypeId: type.id,
        categoryId: category.id,
        locationId: location.id,
        lifecycleState,
        serialNumber: `SN-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
        model: type.name,
        vendor:
          category.slug === "cloud"
            ? "AWS"
            : category.slug === "laptops"
              ? "Apple/Dell"
              : "Cisco/Dell",
        cost: randomInt(1200, 8500),
        purchaseDate: randomDate(new Date(2023, 0, 1), new Date(2025, 6, 1)),
        warrantyExpiresAt: randomDate(new Date(2026, 0, 1), new Date(2028, 11, 31)),
        assignedUserId,
        notes: `CMDB asset record registered for ${location.name}.`,
      },
    });

    createdAssets.push({ id: asset.id, name: asset.name, assetRef: asset.assetRef });
  }
  console.log(`✓ Seeded ${createdAssets.length} CMDB assets.`);

  // 6. Knowledge Base (50 Articles across 6 Categories)
  console.log("📚 Seeding Knowledge Base (50 Articles)...");

  const kbCategoryNames = [
    {
      name: "IT & Network Infrastructure",
      slug: "it-network",
      desc: "VPN, Wi-Fi, DNS, and corporate network access",
    },
    {
      name: "Software & SaaS Applications",
      slug: "software-saas",
      desc: "Okta, Slack, Google Workspace, Jira, Zoom",
    },
    {
      name: "Hardware & Device Management",
      slug: "hardware-devices",
      desc: "Laptop troubleshooting, monitors, peripherals",
    },
    {
      name: "Security & Compliance Guidelines",
      slug: "security-compliance",
      desc: "MFA, password policies, phishing, data privacy",
    },
    {
      name: "HR & Workplace Services",
      slug: "hr-workplace",
      desc: "Onboarding, travel policies, badge access, expense IT",
    },
    {
      name: "Remote Work & Collaboration",
      slug: "remote-collaboration",
      desc: "Remote desktop, home office setup, AV meeting setup",
    },
  ];

  const kbCategories = await Promise.all(
    kbCategoryNames.map((cat) =>
      prisma.kbCategory.upsert({
        where: { tenantId_slug: { tenantId: tenant.id, slug: cat.slug } },
        update: {},
        create: {
          tenantId: tenant.id,
          name: cat.name,
          slug: cat.slug,
          description: cat.desc,
        },
      }),
    ),
  );

  const kbTitles = [
    "How to Connect to Corporate VPN via Cisco AnyConnect",
    "Setting Up Multi-Factor Authentication (MFA) with Okta Verify",
    "Troubleshooting Wi-Fi Connection Issues on macOS Sonoma",
    "Requesting Software License Upgrades in ServiceNow",
    "Best Practices for Strong Password Creation and Storage",
    "Configuring Corporate Email on iOS and Android Devices",
    "Resolving Audio and Camera Issues in Zoom Meetings",
    "How to Request a Monitor or Peripheral Replacement",
    "Reporting Phishing Emails with the Outlook PhishAlert Button",
    "Accessing Financial Reports via Tableau Server",
    "Setting Up Remote Desktop Connection for Windows 11",
    "Printer Setup and Driver Installation for Office Hubs",
    "Understanding the Corporate Data Classification Standard",
    "Guidelines for Using AI Tools in Software Development",
    "How to Request Cloud Sandbox Access in AWS/GCP",
    "Resolving Slack Desktop App Performance Degradation",
    "Requesting Access to Restricted Github Repositories",
    "Overview of SupportDesk Ticket Escalation SLAs",
    "Emergency IT Support Procedures for On-Call Engineers",
    "How to Request a Temporary Admin Privilege Escalation",
    "Configuring Single Sign-On (SSO) for Third-Party SaaS",
    "Troubleshooting Battery Drain on Corporate MacBooks",
    "How to Archive and Clean Up Large Google Drive Folders",
    "Managing Mobile Device Management (MDM) Profiles",
    "Requesting New Hardware for New Employee Onboarding",
    "Understanding Internal Network Subnet Security Groups",
    "How to Recover Deleted Files from Corporate Cloud Backup",
    "Resolving Docker Desktop Memory Allocation Errors",
    "Best Practices for Conducting Secure Virtual Webinars",
    "How to Submit an Emergency Change Request (ECR)",
    "Configuring YubiKey Hardware Security Tokens",
    "Resolving Git SSH Key Authentication Denied Failures",
    "Requesting Access to Confidential Financial Databases",
    "How to Clean and Maintain Corporate Laptop Hardware",
    "Overview of Company Information Security Standards",
    "Setting Up Automated Calendar Out-of-Office Responses",
    "How to Extend Laptop Battery Lifespan",
    "Troubleshooting Dual Monitor Display Resolution Drops",
    "Requesting Ergonomic Desk Peripherals",
    "Understanding Security Incident Reporting Timelines",
    "How to Request Temporary International Travel Roaming",
    "Resolving VS Code Enterprise Extension License Warnings",
    "Guide to Enterprise Data Backup & Disaster Recovery",
    "How to Register Personal Devices for BYOD Network Access",
    "Troubleshooting Corporate VPN Split-Tunneling Drops",
    "How to Request Additional Cloud Compute Resources",
    "Understanding Corporate Software Lifecycle Deprecation",
    "Guide to Setting Up Local Development Environments",
    "How to Request VIP Concierge Executive IT Support",
    "Frequently Asked Questions (FAQ) - SupportDesk Portal",
  ];

  const createdKbArticles: Array<{ id: string; title: string }> = [];

  for (let i = 0; i < kbTitles.length; i++) {
    const rawTitle = kbTitles[i] || `Article #${i}`;
    const slug = rawTitle
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
    const category = kbCategories[i % kbCategories.length]!;
    const authorId = randomItem(createdAgentIds);
    const isPublished = i < 45;
    const status = isPublished ? KbArticleStatus.PUBLISHED : KbArticleStatus.DRAFT;

    const article = await prisma.kbArticle.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug } },
      update: { viewsCount: randomInt(50, 2500) },
      create: {
        tenantId: tenant.id,
        categoryId: category.id,
        authorId,
        title: rawTitle,
        slug,
        summary: `Operational standard guide covering ${rawTitle.toLowerCase()}.`,
        content: `### ${rawTitle}\n\n#### Overview\nStep-by-step instructions for enterprise users.\n\n#### Procedure\n1. Visit the portal.\n2. Authenticate using Okta SSO.\n3. Apply corporate settings.`,
        status,
        viewsCount: randomInt(50, 2500),
        helpfulCount: randomInt(10, 300),
        unhelpfulCount: randomInt(0, 15),
        publishedAt: isPublished ? randomDate(new Date(2024, 0, 1), new Date(2026, 6, 1)) : null,
      },
    });

    createdKbArticles.push({ id: article.id, title: article.title });
  }
  console.log(`✓ Seeded ${createdKbArticles.length} Knowledge Base articles.`);

  // 7. Service Catalog (25 Items across 5 Categories)
  console.log("🛒 Seeding Service Catalog (25 Items)...");

  const catalogCategories = await Promise.all([
    prisma.serviceCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "hardware-requests" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "Hardware & Equipment",
        slug: "hardware-requests",
        description: "Laptops, monitors, peripherals",
      },
    }),
    prisma.serviceCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "software-licenses" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "Software & SaaS Subscriptions",
        slug: "software-licenses",
        description: "Application licenses",
      },
    }),
    prisma.serviceCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "access-permissions" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "Access & Identity",
        slug: "access-permissions",
        description: "System permissions & VPN",
      },
    }),
    prisma.serviceCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "cloud-infrastructure" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "Cloud & Compute Resources",
        slug: "cloud-infrastructure",
        description: "AWS EC2 & S3 compute",
      },
    }),
    prisma.serviceCategory.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: "workplace-onboarding" } },
      update: {},
      create: {
        tenantId: tenant.id,
        name: "Workplace & Onboarding",
        slug: "workplace-onboarding",
        description: "New hire setup & moves",
      },
    }),
  ]);

  const [c0, c1, c2, c3, c4] = catalogCategories;
  if (!c0 || !c1 || !c2 || !c3 || !c4) {
    throw new Error("Failed to seed catalog categories");
  }

  const catalogItemDefs = [
    {
      name: 'MacBook Pro 16" Provisioning',
      slug: "request-macbook-pro-16",
      category: c0,
      approval: true,
    },
    {
      name: 'Dell 27" 4K USB-C Monitor Request',
      slug: "request-dell-27-monitor",
      category: c0,
      approval: false,
    },
    {
      name: "Ergonomic Standing Desk Converter",
      slug: "request-standing-desk",
      category: c0,
      approval: true,
    },
    {
      name: "Jabra Evolve2 Wireless Headset",
      slug: "request-wireless-headset",
      category: c0,
      approval: false,
    },
    {
      name: "YubiKey 5C NFC Security Token",
      slug: "request-yubikey-token",
      category: c0,
      approval: false,
    },

    {
      name: "GitHub Enterprise License",
      slug: "request-github-license",
      category: c1,
      approval: true,
    },
    {
      name: "JetBrains All Products Pack",
      slug: "request-jetbrains-license",
      category: c1,
      approval: true,
    },
    {
      name: "Tableau Creator SaaS License",
      slug: "request-tableau-license",
      category: c1,
      approval: true,
    },
    {
      name: "Figma Professional Editor License",
      slug: "request-figma-license",
      category: c1,
      approval: false,
    },
    {
      name: "Adobe Creative Cloud All Apps",
      slug: "request-adobe-cc-license",
      category: c1,
      approval: true,
    },

    {
      name: "Production Database Read-Only Access",
      slug: "request-db-readonly-access",
      category: c2,
      approval: true,
    },
    {
      name: "AWS Cloud Console Administrator Access",
      slug: "request-aws-admin-access",
      category: c2,
      approval: true,
    },
    {
      name: "Corporate VPN Static IP Address",
      slug: "request-vpn-static-ip",
      category: c2,
      approval: false,
    },
    {
      name: "Production Kubernetes Cluster Access",
      slug: "request-k8s-cluster-access",
      category: c2,
      approval: true,
    },
    {
      name: "Salesforce CRM Admin Role Access",
      slug: "request-salesforce-admin-access",
      category: c2,
      approval: true,
    },

    {
      name: "AWS EC2 On-Demand Compute Instance",
      slug: "request-aws-ec2-instance",
      category: c3,
      approval: true,
    },
    {
      name: "Dedicated AWS S3 Encrypted Bucket",
      slug: "request-aws-s3-bucket",
      category: c3,
      approval: false,
    },
    {
      name: "Isolated Staging Environment Namespace",
      slug: "request-staging-namespace",
      category: c3,
      approval: true,
    },
    {
      name: "Redis Enterprise Cache Cluster",
      slug: "request-redis-cache-cluster",
      category: c3,
      approval: true,
    },
    {
      name: "Elasticsearch Dedicated Analytics Node",
      slug: "request-elasticsearch-node",
      category: c3,
      approval: true,
    },

    {
      name: "New Employee IT Onboarding Bundle",
      slug: "request-new-employee-bundle",
      category: c4,
      approval: true,
    },
    {
      name: "Building Keycard Access Escalation",
      slug: "request-keycard-badge-access",
      category: c4,
      approval: false,
    },
    {
      name: "Department Desk Relocation Service",
      slug: "request-desk-relocation",
      category: c4,
      approval: false,
    },
    {
      name: "Temporary International Roaming Plan",
      slug: "request-international-roaming",
      category: c4,
      approval: true,
    },
    {
      name: "Executive Conference Room AV Setup",
      slug: "request-executive-av-setup",
      category: c4,
      approval: false,
    },
  ];

  for (const itemDef of catalogItemDefs) {
    const item = await prisma.serviceItem.upsert({
      where: { tenantId_slug: { tenantId: tenant.id, slug: itemDef.slug } },
      update: {},
      create: {
        tenantId: tenant.id,
        categoryId: itemDef.category.id,
        name: itemDef.name,
        slug: itemDef.slug,
        description: `Enterprise service request for ${itemDef.name}.`,
        kind: ServiceKind.BUSINESS,
        state: ConfigPublicationState.PUBLISHED,
        approvalMode: itemDef.approval ? ServiceApprovalMode.SINGLE : ServiceApprovalMode.NONE,
        approvalSteps: itemDef.approval ? [{ ordinal: 1, approverRole: "TENANT_ADMIN" }] : [],
      },
    });
    await prisma.serviceRequestForm.upsert({
      where: { serviceId: item.id },
      update: {},
      create: {
        tenantId: tenant.id,
        serviceId: item.id,
        formVersion: 1,
        schema: {
          fields: [{ key: "details", label: "Details", type: "TEXTAREA", required: true }],
        },
      },
    });
  }
  console.log(`✓ Seeded 25 Service Catalog items.`);

  // 8. SLA Policies & Business Schedules
  console.log("⏱️  Seeding SLA Policies & Schedules...");

  const schedule = await prisma.businessSchedule.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "us-business-hours" } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: "us-business-hours",
      name: "US Business Hours (9 AM - 5 PM EST)",
      description: "Standard corporate support hours",
      activeVersionNumber: 1,
      versions: {
        create: [
          {
            tenantId: tenant.id,
            versionNumber: 1,
            timeZone: "America/New_York",
            state: ConfigPublicationState.PUBLISHED,
            weeklyHours: {
              mon: [{ start: "09:00", end: "17:00" }],
              tue: [{ start: "09:00", end: "17:00" }],
              wed: [{ start: "09:00", end: "17:00" }],
              thu: [{ start: "09:00", end: "17:00" }],
              fri: [{ start: "09:00", end: "17:00" }],
            },
            publishedAt: new Date(2024, 0, 1),
          },
        ],
      },
    },
  });

  await prisma.slaPolicy.upsert({
    where: { tenantId_key: { tenantId: tenant.id, key: "gold-sla-policy" } },
    update: {},
    create: {
      tenantId: tenant.id,
      key: "gold-sla-policy",
      name: "Enterprise Gold SLA Policy",
      description: "Default SLA policy for enterprise incidents",
      versions: {
        create: [
          {
            tenantId: tenant.id,
            versionNumber: 1,
            state: ConfigPublicationState.PUBLISHED,
            priority: 1,
            scheduleKey: schedule.key,
            responseMinutes: 30,
            resolutionMinutes: 240,
            publishedAt: new Date(2024, 0, 1),
          },
        ],
      },
    },
  });
  console.log(`✓ Seeded SLA Policies & Schedules.`);

  // 9. Workflows (4 Workflows)
  console.log("⚙️  Seeding Workflows...");

  const workflowsData = [
    {
      key: "urgent-incident-triage",
      name: "Automated Urgent Incident Triage",
      desc: "Auto-assigns urgent tickets and alerts on-call leads",
    },
    {
      key: "catalog-approval-flow",
      name: "Service Catalog Access Request Approval",
      desc: "Routes high-cost service requests to manager approval",
    },
    {
      key: "laptop-provisioning-pipeline",
      name: "Hardware Asset Provisioning Pipeline",
      desc: "Initiates MDM enrollment and security agent deployment",
    },
    {
      key: "user-offboarding-checklist",
      name: "Employee IT Offboarding Checklist",
      desc: "Revokes OAuth tokens, locks sessions, and flags assets",
    },
  ];

  for (let idx = 0; idx < workflowsData.length; idx++) {
    const wf = workflowsData[idx]!;
    await prisma.workflow.upsert({
      where: { tenantId_key: { tenantId: tenant.id, key: wf.key } },
      update: {},
      create: {
        tenantId: tenant.id,
        key: wf.key,
        name: wf.name,
        description: wf.desc,
        priority: idx + 1,
        enabled: true,
        versions: {
          create: [
            {
              tenantId: tenant.id,
              versionNumber: 1,
              state: ConfigPublicationState.PUBLISHED,
              triggers: [{ type: "TICKET_CREATED" }],
              conditions: [{ priority: "URGENT" }],
              actions: [{ type: "ASSIGN_AGENT" }],
              publishedAt: new Date(2024, 0, 1),
            },
          ],
        },
      },
    });
  }
  console.log(`✓ Seeded 4 Workflows.`);

  // 10. Seed 500 Tickets with Comments
  console.log("🎫 Seeding 500 Tickets & 750+ Comments...");

  const ticketTitles = [
    "High CPU utilization on Production Aurora PostgreSQL Node #3",
    "Cannot authenticate to Cisco AnyConnect VPN after password update",
    "SSO Login Loop failure when accessing Okta dashboard from Chrome",
    "Request for 32GB RAM upgrade on MacBook Pro AST-1014",
    "YubiKey 5C Hardware Token not recognized by macOS USB-C port",
    "Docker Desktop Kubernetes cluster failing to initialize on startup",
    "Outbox queue delivery backlog exceeding 50,000 pending events",
    "Database connection pool exhausted during peak morning traffic",
    "Requesting GitHub Enterprise Organization write access for repo",
    "Phishing email attempt impersonating Finance VP detected",
    "Zoom Web Client screen sharing black screen issue on Sonoma",
    "New Hire IT Setup Bundle for Senior Frontend Engineer",
    "Salesforce CRM API integration returning HTTP 429 Rate Limit",
    "Requesting AWS EC2 r6g.4xlarge instance for load testing",
    "Tableau Server dashboard views failing to refresh scheduled data",
    "Office Wi-Fi SSID 'Acme-Corp-Secure' frequent disconnections",
    'Requesting Monitor Replacement for flickering 27" Dell 4K',
    "SSL Certificate expiration warning on api.internal.acme.com",
    "Slack Desktop notification sound disabled after OS update",
    "Requesting Access to Staging Redis Cluster for Caching",
    "Jira Cloud Board Automation rule execution failed",
    "Requesting Office Desk Ergonomic Monitor Arm Setup",
    "VPN Split-Tunneling routing failure when accessing AWS VPC",
    "Requesting YubiKey replacement for lost hardware token",
    "Production Redis cache eviction rate spike alert",
  ];

  const statuses = [
    TicketStatus.NEW,
    TicketStatus.OPEN,
    TicketStatus.OPEN,
    TicketStatus.PENDING,
    TicketStatus.SOLVED,
    TicketStatus.CLOSED,
  ];

  const priorities = [
    TicketPriority.LOW,
    TicketPriority.MEDIUM,
    TicketPriority.MEDIUM,
    TicketPriority.HIGH,
    TicketPriority.URGENT,
  ];

  const types = [
    TicketType.INCIDENT,
    TicketType.INCIDENT,
    TicketType.QUESTION,
    TicketType.PROBLEM,
    TicketType.FEATURE_REQUEST,
  ];

  const channels = [TicketChannel.WEB, TicketChannel.EMAIL, TicketChannel.API, TicketChannel.CHAT];

  const ticketBatchData = [];
  const now = Date.now();
  const ninetyDaysAgo = now - 90 * 24 * 60 * 60 * 1000;

  for (let i = 1; i <= 500; i++) {
    const publicRef = `TKT-${1000 + i}`;
    const baseTitle = randomItem(ticketTitles);
    const title = `${baseTitle} (Ref #${i})`;
    const status = randomItem(statuses);
    const priority = randomItem(priorities);
    const type = randomItem(types);
    const channel = randomItem(channels);
    const requesterUserId = randomItem(createdRequesterIds);
    const assigneeUserId = status === TicketStatus.NEW ? null : randomItem(createdAgentIds);
    const createdAt = new Date(ninetyDaysAgo + (i / 500) * (now - ninetyDaysAgo));
    const solvedAt =
      status === TicketStatus.SOLVED || status === TicketStatus.CLOSED
        ? new Date(createdAt.getTime() + randomInt(2, 48) * 3600 * 1000)
        : null;
    const closedAt =
      status === TicketStatus.CLOSED
        ? new Date((solvedAt || createdAt).getTime() + randomInt(1, 24) * 3600 * 1000)
        : null;

    ticketBatchData.push({
      tenantId: tenant.id,
      publicRef,
      title,
      description: `Detailed incident description for #${publicRef}. Impacting user productivity under ${priority} priority.`,
      status,
      priority,
      type,
      channel,
      requesterUserId,
      assigneeUserId,
      solvedAt,
      closedAt,
      createdAt,
      updatedAt: closedAt || solvedAt || createdAt,
    });
  }

  await prisma.comment.deleteMany({ where: { tenantId: tenant.id } });
  await prisma.ticket.deleteMany({ where: { tenantId: tenant.id } });

  console.log("  Inserting 500 tickets into database...");
  for (let i = 0; i < ticketBatchData.length; i += 50) {
    const chunk = ticketBatchData.slice(i, i + 50);
    await prisma.ticket.createMany({ data: chunk });
  }

  const allTickets = await prisma.ticket.findMany({
    where: { tenantId: tenant.id },
    select: { id: true, status: true, assigneeUserId: true, createdAt: true },
  });

  console.log(`✓ Seeded ${allTickets.length} tickets.`);

  // 11. Seed 750+ Comments
  console.log("💬 Seeding Ticket Comments...");

  const commentTexts = [
    "Investigating initial log entries. Checking connection pool sizing.",
    "User verified problem reproduces on macOS Sonoma 14.5.",
    "Applying hotfix configuration patch to application nodes.",
    "Escalating ticket to L3 Infrastructure Operations team.",
    "Replacement hardware dispatch initiated via FedEx.",
    "Security token credentials reset in Okta Admin panel.",
    "SLA response milestone satisfied. Updating ticket priority.",
    "Issue resolved after restarting background worker daemon.",
    "Closing ticket as verified fixed by user.",
    "Pending confirmation from user regarding fix deployment.",
  ];

  const commentBatch: Array<{
    tenantId: string;
    ticketId: string;
    authorUserId: string;
    body: string;
    visibility: CommentVisibility;
    createdAt: Date;
  }> = [];

  for (const t of allTickets) {
    const commentCount = randomInt(1, 3);
    for (let c = 0; c < commentCount; c++) {
      const authorUserId = t.assigneeUserId || randomItem(createdAgentIds);
      const text = commentTexts[(c + commentBatch.length) % commentTexts.length] as string;
      commentBatch.push({
        tenantId: tenant.id,
        ticketId: t.id,
        authorUserId,
        body: text,
        visibility: c % 2 === 0 ? CommentVisibility.PUBLIC : CommentVisibility.INTERNAL,
        createdAt: new Date(t.createdAt.getTime() + (c + 1) * 1800 * 1000),
      });
    }
  }

  for (let i = 0; i < commentBatch.length; i += 100) {
    const chunk = commentBatch.slice(i, i + 100);
    await prisma.comment.createMany({ data: chunk });
  }
  console.log(`✓ Seeded ${commentBatch.length} ticket comments.`);

  // 12. Seed 120 Audit Log Events
  console.log("📜 Seeding Platform Audit Logs...");

  const auditActions = [
    "auth.login.succeeded",
    "user.updated",
    "role.assigned",
    "ticket.created",
    "ticket.status_changed",
    "ticket.assigned",
    "asset.created",
    "asset.updated",
    "kb.article_published",
    "workflow.executed",
  ];

  const auditBatch: Array<{
    tenantId: string;
    action: string;
    actorUserId: string;
    targetType: string;
    targetId: string;
    outcome: AuditOutcome;
    correlationId: string;
    ipAddress: string;
    userAgent: string;
    metadata: string;
    occurredAt: Date;
  }> = [];

  for (let i = 0; i < 120; i++) {
    const action = randomItem(auditActions);
    const actorUserId = randomItem(createdUserIds);
    auditBatch.push({
      tenantId: tenant.id,
      action,
      actorUserId,
      targetType: action.split(".")[0] || "system",
      targetId: randomItem(createdUserIds),
      outcome: AuditOutcome.SUCCESS,
      correlationId: `corr-${Math.random().toString(36).substring(2, 12)}`,
      ipAddress: `192.168.1.${randomInt(10, 250)}`,
      userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)",
      metadata: JSON.stringify({ source: "SeedGenerator", index: i }),
      occurredAt: randomDate(new Date(2026, 0, 1), new Date()),
    });
  }

  await prisma.auditEvent.createMany({ data: auditBatch });
  console.log(`✓ Seeded ${auditBatch.length} platform audit log events.`);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log(`\n🎉 ENTERPRISE DEMO DATASET SEEDED SUCCESSFULLY IN ${durationSec}s! 🎉`);
  console.log("----------------------------------------------------------------");
  console.log(`• Users:           55 (5 Admins, 20 Agents, 30 Requesters)`);
  console.log(`• CMDB Assets:     ${createdAssets.length} (across 5 locations)`);
  console.log(`• KB Articles:     ${createdKbArticles.length} (across 6 categories)`);
  console.log(`• Service Catalog: 25 Service Items (across 5 categories)`);
  console.log(`• Workflows:       4 Workflow Definitions`);
  console.log(`• Tickets:         ${allTickets.length} (500 tickets, 750+ comments)`);
  console.log(`• Audit Logs:      120 Audit Events`);
  console.log("----------------------------------------------------------------\n");
}

main()
  .catch((e) => {
    console.error("❌ Seed Script Error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
