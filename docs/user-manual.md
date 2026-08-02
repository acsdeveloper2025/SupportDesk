# SupportDesk Enterprise v1.0 — User & Agent Manual

This guide provides end-users, support agents, and team managers with step-by-step instructions for using the SupportDesk Enterprise portal.

---

## 1. End-User Portal

### Submitting a Support Ticket

1. Log in to the SupportDesk Portal (`https://supportdesk.example.com`).
2. Click **New Ticket** in the top navigation header.
3. Select the appropriate **Category** (e.g., `Hardware`, `Software`, `Network Access`, `General Request`).
4. Provide a clear **Title** and detailed **Description**.
5. Attach relevant screenshot files or error logs (up to 50 MB per file).
6. Click **Submit Ticket**. You will receive an automated confirmation email with your unique ticket reference code (e.g., `INC-10042`).

### Service Catalog Requests

1. Navigate to the **Service Catalog** tab.
2. Select a standardized item (e.g., `Request New Laptop`, `Grant AWS Access`, `Software License Procurement`).
3. Fill out required form parameters (e.g., justification, department cost center).
4. Track request approval progress in real time.

### Searching the Knowledge Base

1. Type search keywords into the global portal search bar.
2. Browse categorized articles to find self-service resolution guides.
3. Rate article helpfulness using the **Yes / No** feedback buttons.

---

## 2. Agent Workspace & Queue Management

### Managing Ticket Queues

Support agents access the Agent Workspace (`/tickets`) to view assigned queues:

- **Views**: Filter by _My Assigned Tickets_, _Unassigned Team Queue_, _Critical Priority_, or _SLA Nearing Breach_.
- **Status Updates**: Transition tickets from `OPEN` -> `IN_PROGRESS` -> `RESOLVED` -> `CLOSED`.
- **Internal Notes vs. Public Replies**: Use **Public Reply** to respond to end-users, or **Internal Note** (yellow box) for agent-only technical collaboration.

### CMDB Asset Linking

When investigating an incident:

1. Open the **Asset CMDB** panel on the right sidebar of the ticket.
2. Search and link the impacted infrastructure asset (e.g., `Server: db-primary.internal`).
3. View asset maintenance history and linked incident trends.

---

## 3. Manager & Team Lead Workflows

- **Approvals (`/approvals`)**: Review pending service catalog requests requiring manager authorization.
- **Workload Reassignment**: Reassign tickets across agents or teams to balance capacity.
- **Analytics**: Monitor team SLA compliance rates and first-contact resolution metrics.
