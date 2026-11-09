import * as React from "react";
import { cn } from "@/lib/utils";

export type Feedback = { tone: "info" | "error"; text: string };

export interface FormMessageProps extends React.HTMLAttributes<HTMLParagraphElement> {
  tone?: Feedback["tone"];
}

function FormMessage({ className, tone = "error", children, ...props }: FormMessageProps) {
  if (!children) return null;

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("text-sm", tone === "error" ? "text-red-600" : "text-slate-500", className)}
      {...props}
    >
      {children}
    </p>
  );
}

export { FormMessage };
