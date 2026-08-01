import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { TicketStatusBadge } from "../components/ticket-status-badge";

describe("TicketStatusBadge", () => {
  it("renders NEW status", () => {
    render(<TicketStatusBadge status="NEW" />);
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("renders OPEN status", () => {
    render(<TicketStatusBadge status="OPEN" />);
    expect(screen.getByText("Open")).toBeInTheDocument();
  });

  it("renders PENDING status", () => {
    render(<TicketStatusBadge status="PENDING" />);
    expect(screen.getByText("Pending")).toBeInTheDocument();
  });

  it("renders ON_HOLD status", () => {
    render(<TicketStatusBadge status="ON_HOLD" />);
    expect(screen.getByText("On Hold")).toBeInTheDocument();
  });

  it("renders SOLVED status", () => {
    render(<TicketStatusBadge status="SOLVED" />);
    expect(screen.getByText("Solved")).toBeInTheDocument();
  });

  it("renders CLOSED status", () => {
    render(<TicketStatusBadge status="CLOSED" />);
    expect(screen.getByText("Closed")).toBeInTheDocument();
  });
});
