"use client";

import { Button } from "@supportdesk/ui/button";
import { Send } from "lucide-react";
import { useState } from "react";
import { useForm } from "react-hook-form";

import type { CommentVisibility, CreateCommentPayload } from "../types";

interface CommentFormProps {
  canPostInternal?: boolean;
  onSubmit: (payload: CreateCommentPayload) => Promise<void>;
}

interface CommentFormValues {
  body: string;
  visibility: CommentVisibility;
}

export function CommentForm({ canPostInternal = false, onSubmit }: Readonly<CommentFormProps>) {
  const [submitError, setSubmitError] = useState<string | null>(null);
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
  } = useForm<CommentFormValues>({
    defaultValues: { body: "", visibility: "PUBLIC" },
  });

  async function handleFormSubmit(values: CommentFormValues) {
    setSubmitError(null);
    try {
      await onSubmit({ body: values.body, visibility: values.visibility });
      reset();
    } catch {
      setSubmitError("Failed to post comment. Please try again.");
    }
  }

  return (
    <form
      className="space-y-3"
      onSubmit={(e) => {
        void handleSubmit(handleFormSubmit)(e);
      }}
    >
      <div>
        <label className="sr-only" htmlFor="comment-body">
          Comment body
        </label>
        <textarea
          aria-describedby={errors.body ? "comment-body-error" : undefined}
          className="min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          disabled={isSubmitting}
          id="comment-body"
          placeholder="Write a comment…"
          {...register("body", { required: "Comment body is required." })}
        />
        {errors.body ? (
          <p className="mt-1 text-xs text-red-700" id="comment-body-error" role="alert">
            {errors.body.message}
          </p>
        ) : null}
      </div>

      <div className="flex items-center justify-between gap-3">
        {canPostInternal ? (
          <div className="flex items-center gap-2">
            <label className="text-xs font-medium text-slate-600" htmlFor="comment-visibility">
              Visibility
            </label>
            <select
              className="rounded border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-300"
              id="comment-visibility"
              {...register("visibility")}
            >
              <option value="PUBLIC">Public</option>
              <option value="INTERNAL">Internal</option>
            </select>
          </div>
        ) : (
          <span />
        )}

        <Button disabled={isSubmitting} size="sm" type="submit">
          <Send aria-hidden="true" size={14} />
          {isSubmitting ? "Posting…" : "Post comment"}
        </Button>
      </div>

      {submitError ? (
        <p className="text-sm text-red-700" role="alert">
          {submitError}
        </p>
      ) : null}
    </form>
  );
}
