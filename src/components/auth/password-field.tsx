"use client";

import { Eye, EyeOff } from "lucide-react";
import { type ChangeEventHandler, useState } from "react";

import { Input } from "@/components/ui/input";

interface PasswordFieldProps {
  "aria-describedby"?: string;
  "aria-invalid"?: boolean;
  autoComplete: "current-password" | "new-password";
  id: string;
  label: string;
  name: string;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  value?: string;
}

export function PasswordField({
  "aria-describedby": ariaDescribedBy,
  "aria-invalid": ariaInvalid,
  autoComplete,
  id,
  label,
  name,
  onChange,
  value,
}: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium text-foreground" htmlFor={id}>
        {label}
      </label>
      <div className="relative">
        <Input
          aria-describedby={ariaDescribedBy}
          aria-invalid={ariaInvalid}
          autoComplete={autoComplete}
          className="pr-11"
          id={id}
          maxLength={128}
          minLength={10}
          name={name}
          onChange={onChange}
          required
          type={visible ? "text" : "password"}
          value={value}
        />
        <button
          type="button"
          className="absolute inset-y-0 right-0 grid w-11 place-items-center text-muted-foreground transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-[-3px] focus-visible:outline-ring"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? "隐藏密码" : "显示密码"}
          aria-pressed={visible}
        >
          {visible ? (
            <EyeOff className="size-4" aria-hidden="true" />
          ) : (
            <Eye className="size-4" aria-hidden="true" />
          )}
        </button>
      </div>
    </div>
  );
}
