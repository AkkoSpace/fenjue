"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

import { PasswordField } from "@/components/auth/password-field";
import { SubmitButton } from "@/components/auth/submit-button";
import { Input } from "@/components/ui/input";
import { signUp, type SignUpState } from "@/lib/auth/actions";

const INITIAL_STATE: SignUpState = {};
const ERROR_ID = "register-error";

export function RegisterForm() {
  const [state, formAction] = useActionState(signUp, INITIAL_STATE);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [passwordConfirmation, setPasswordConfirmation] = useState("");
  const hasError = Boolean(state.messages?.length);

  return (
    <form action={formAction} className="space-y-5">
      {hasError ? (
        <div
          className="border-l-2 border-destructive bg-destructive/6 px-3 py-2.5 text-sm leading-6 text-destructive"
          id={ERROR_ID}
          role="alert"
        >
          <p className="font-medium">请检查以下内容：</p>
          <ul className="mt-1 list-disc space-y-1 pl-5">
            {state.messages?.map((message) => <li key={message}>{message}</li>)}
          </ul>
        </div>
      ) : null}

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="displayName">
          昵称 <span className="font-normal text-muted-foreground">（可选）</span>
        </label>
        <Input
          aria-describedby={state.field === "displayName" ? ERROR_ID : undefined}
          aria-invalid={state.field === "displayName" || undefined}
          autoComplete="nickname"
          id="displayName"
          maxLength={50}
          name="displayName"
          onChange={(event) => setDisplayName(event.target.value)}
          value={displayName}
        />
      </div>

      <div className="space-y-2">
        <label className="text-sm font-medium text-foreground" htmlFor="email">
          邮箱
        </label>
        <Input
          aria-describedby={state.field === "email" ? ERROR_ID : undefined}
          aria-invalid={state.field === "email" || undefined}
          autoComplete="email"
          id="email"
          inputMode="email"
          name="email"
          onChange={(event) => setEmail(event.target.value)}
          required
          type="email"
          value={email}
        />
      </div>

      <PasswordField
        aria-describedby={state.field === "password" ? ERROR_ID : undefined}
        aria-invalid={state.field === "password" || undefined}
        autoComplete="new-password"
        id="password"
        label="密码"
        name="password"
        onChange={(event) => setPassword(event.target.value)}
        value={password}
      />
      <p className="-mt-3 text-xs leading-5 text-muted-foreground">
        至少 10 个字符，建议使用密码管理器生成并保存。
      </p>
      <PasswordField
        aria-describedby={state.field === "password" ? ERROR_ID : undefined}
        aria-invalid={state.field === "password" || undefined}
        autoComplete="new-password"
        id="passwordConfirmation"
        label="确认密码"
        name="passwordConfirmation"
        onChange={(event) => setPasswordConfirmation(event.target.value)}
        value={passwordConfirmation}
      />
      <SubmitButton pendingLabel="正在创建">创建账户</SubmitButton>
      <p className="text-center text-sm text-muted-foreground">
        同一邮箱只对应一个账户。已有账户？{" "}
        <Link
          className="text-foreground underline decoration-border underline-offset-4 transition-colors hover:text-primary hover:decoration-primary focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ring"
          href="/login"
        >
          返回登录
        </Link>
      </p>
    </form>
  );
}
