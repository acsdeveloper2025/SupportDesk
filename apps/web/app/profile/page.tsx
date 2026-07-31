"use client";

import { Button } from "@supportdesk/ui/button";
import { UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";

interface ProfileValues {
  displayName: string;
  language: string;
  locale: string;
  timeZone: string;
}

interface CurrentIdentity {
  email?: string;
  preferences?: Record<string, unknown>;
  profile?: Partial<ProfileValues> & {
    profilePicturePlaceholder?: string | null;
  };
  roles?: Array<{
    key?: string;
    name?: string;
  }>;
  tenantId?: string;
}

export default function ProfilePage() {
  const [identity, setIdentity] = useState<CurrentIdentity | null>(null);
  const { register, reset } = useForm<ProfileValues>({
    defaultValues: {
      displayName: "",
      language: "",
      locale: "",
      timeZone: "",
    },
  });

  useEffect(() => {
    let active = true;

    async function loadIdentity() {
      const response = await fetch("/api/auth/me", {
        method: "GET",
      });

      if (!response.ok) {
        return;
      }

      const body = (await response.json()) as CurrentIdentity;

      if (!active) {
        return;
      }

      setIdentity(body);
      reset({
        displayName: body.profile?.displayName ?? "",
        language: body.profile?.language ?? "",
        locale: body.profile?.locale ?? "",
        timeZone: body.profile?.timeZone ?? "",
      });
    }

    void loadIdentity();

    return () => {
      active = false;
    };
  }, [reset]);

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-10 text-slate-950">
      <section className="mx-auto w-full max-w-3xl">
        <div className="mb-8 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center rounded-lg bg-slate-950 text-lg font-semibold text-white">
            {identity?.profile?.profilePicturePlaceholder ?? (
              <UserCircle aria-hidden="true" size={24} />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold uppercase tracking-normal text-slate-500">
              Identity
            </p>
            <h1 className="mt-2 text-3xl font-semibold tracking-normal">Profile</h1>
          </div>
        </div>
        <form className="grid gap-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:grid-cols-2">
          <ProfileField label="Display name" registration={register("displayName")} />
          <ProfileField label="Time zone" registration={register("timeZone")} />
          <ProfileField label="Language" registration={register("language")} />
          <ProfileField label="Locale" registration={register("locale")} />
          <div className="sm:col-span-2">
            <label className="text-sm font-medium text-slate-700" htmlFor="preferences">
              Preferences
            </label>
            <textarea
              className="mt-2 min-h-24 w-full rounded-md border border-slate-300 bg-white px-3 py-2 font-mono text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
              id="preferences"
              readOnly
              value={JSON.stringify(identity?.preferences ?? {}, null, 2)}
            />
          </div>
          <div className="sm:col-span-2">
            <Button disabled type="button" variant="secondary">
              <UserCircle aria-hidden="true" size={18} />
              Save profile
            </Button>
          </div>
        </form>
      </section>
    </main>
  );
}

function ProfileField({
  label,
  registration,
}: Readonly<{
  label: string;
  registration: ReturnType<typeof useForm<ProfileValues>>["register"] extends (
    ...args: never[]
  ) => infer R
    ? R
    : never;
}>) {
  const id = label.toLowerCase().replaceAll(" ", "-");

  return (
    <div>
      <label className="text-sm font-medium text-slate-700" htmlFor={id}>
        {label}
      </label>
      <input
        className="mt-2 h-10 w-full rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-950 outline-none transition focus:border-slate-950 focus:ring-2 focus:ring-slate-200"
        id={id}
        type="text"
        {...registration}
      />
    </div>
  );
}
