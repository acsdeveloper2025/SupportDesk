"use client";

import { Button } from "@supportdesk/ui/button";
import { Save, X } from "lucide-react";
import { useForm } from "react-hook-form";

import type { Ticket, UpdateTicketPayload } from "../types";

interface EditTicketFormProps {
  ticket: Ticket;
  onSave: (payload: UpdateTicketPayload) => Promise<void>;
  onCancel: () => void;
}

interface EditFormValues {
  title: string;
  description: string;
  priority: string;
  type: string;
  channel: string;
  dueDate: string;
}

export function EditTicketForm({ ticket, onSave, onCancel }: Readonly<EditTicketFormProps>) {
  const {
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
  } = useForm<EditFormValues>({
    defaultValues: {
      title: ticket.title,
      description: ticket.description,
      priority: ticket.priority,
      type: ticket.type,
      channel: ticket.channel,
      dueDate: ticket.dueDate ? ticket.dueDate.slice(0, 10) : "",
    },
  });

  async function handleFormSubmit(values: EditFormValues) {
    const payload: UpdateTicketPayload = {
      version: ticket.version,
      title: values.title.trim() || undefined,
      description: values.description.trim() || undefined,
      priority: (values.priority as Ticket["priority"]) || undefined,
      type: (values.type as Ticket["type"]) || undefined,
      channel: (values.channel as Ticket["channel"]) || undefined,
      dueDate: values.dueDate ? new Date(values.dueDate).toISOString() : null,
    };
    await onSave(payload);
  }

  return (
    <form
      aria-label="Edit ticket"
      className="space-y-5"
      onSubmit={(e) => {
        void handleSubmit(handleFormSubmit)(e);
      }}
    >
      {/* Title */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="edit-title">
          Title{" "}
          <span aria-hidden="true" className="text-red-500">
            *
          </span>
        </label>
        <input
          className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          disabled={isSubmitting}
          id="edit-title"
          type="text"
          {...register("title", {
            required: "Title is required.",
            maxLength: { value: 255, message: "Title cannot exceed 255 characters." },
          })}
        />
        {errors.title ? (
          <p className="text-xs text-red-700" role="alert">
            {errors.title.message}
          </p>
        ) : null}
      </div>

      {/* Description */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="edit-description">
          Description
        </label>
        <textarea
          className="min-h-28 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          disabled={isSubmitting}
          id="edit-description"
          {...register("description")}
        />
      </div>

      {/* Priority / Type / Channel */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="edit-priority">
            Priority
          </label>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
            disabled={isSubmitting}
            id="edit-priority"
            {...register("priority")}
          >
            <option value="LOW">Low</option>
            <option value="MEDIUM">Medium</option>
            <option value="HIGH">High</option>
            <option value="URGENT">Urgent</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="edit-type">
            Type
          </label>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
            disabled={isSubmitting}
            id="edit-type"
            {...register("type")}
          >
            <option value="QUESTION">Question</option>
            <option value="INCIDENT">Incident</option>
            <option value="PROBLEM">Problem</option>
            <option value="TASK">Task</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-medium text-slate-700" htmlFor="edit-channel">
            Channel
          </label>
          <select
            className="h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
            disabled={isSubmitting}
            id="edit-channel"
            {...register("channel")}
          >
            <option value="WEB">Web</option>
            <option value="EMAIL">Email</option>
            <option value="PHONE">Phone</option>
            <option value="API">API</option>
            <option value="CHAT">Chat</option>
          </select>
        </div>
      </div>

      {/* Due Date */}
      <div className="space-y-1">
        <label className="text-sm font-medium text-slate-700" htmlFor="edit-due-date">
          Due Date
        </label>
        <input
          className="h-10 w-48 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200 disabled:opacity-50"
          disabled={isSubmitting}
          id="edit-due-date"
          type="date"
          {...register("dueDate")}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 border-t border-slate-100 pt-4">
        <Button disabled={isSubmitting} type="submit">
          <Save aria-hidden="true" size={16} />
          {isSubmitting ? "Saving…" : "Save changes"}
        </Button>
        <Button disabled={isSubmitting} onClick={onCancel} type="button" variant="secondary">
          <X aria-hidden="true" size={16} />
          Cancel
        </Button>
      </div>
    </form>
  );
}
