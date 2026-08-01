import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { CommentForm } from "../components/comment-form";

describe("CommentForm", () => {
  it("renders the comment textarea and submit button", () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    expect(screen.getByPlaceholderText("Write a comment…")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /post comment/i })).toBeInTheDocument();
  });

  it("shows a validation error when submitting an empty comment", async () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    expect(await screen.findByText("Comment body is required.")).toBeInTheDocument();
  });

  it("calls onSubmit with the comment body and resets the form", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(<CommentForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), {
      target: { value: "Test comment body" },
    });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    await waitFor(() =>
      expect(onSubmit).toHaveBeenCalledWith({
        body: "Test comment body",
        visibility: "PUBLIC",
      }),
    );
    await waitFor(() => expect(screen.getByPlaceholderText("Write a comment…")).toHaveValue(""));
  });

  it("shows an error banner when onSubmit throws", async () => {
    const onSubmit = vi.fn().mockRejectedValue(new Error("Network error"));
    render(<CommentForm onSubmit={onSubmit} />);
    fireEvent.change(screen.getByPlaceholderText("Write a comment…"), {
      target: { value: "Some text" },
    });
    fireEvent.click(screen.getByRole("button", { name: /post comment/i }));
    expect(
      await screen.findByText("Failed to post comment. Please try again."),
    ).toBeInTheDocument();
  });

  it("shows visibility selector when canPostInternal is true", () => {
    render(<CommentForm canPostInternal onSubmit={vi.fn()} />);
    expect(screen.getByLabelText("Visibility")).toBeInTheDocument();
    expect(screen.getByRole("option", { name: "Internal" })).toBeInTheDocument();
  });

  it("hides visibility selector when canPostInternal is false", () => {
    render(<CommentForm onSubmit={vi.fn()} />);
    expect(screen.queryByLabelText("Visibility")).not.toBeInTheDocument();
  });
});
