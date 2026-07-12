import { toast as sonnerToast } from "sonner";

// Lightweight shadcn-compatible `useToast`/`toast` shim backed by sonner, so
// ported pages that expect the shadcn toast API work without pulling in
// @radix-ui/react-toast.
type ToastArgs = {
  title?: string;
  description?: string;
  variant?: "default" | "destructive" | string;
};

export function toast({ title, description, variant }: ToastArgs) {
  const message = title ?? description ?? "";
  const options = title && description ? { description } : undefined;
  if (variant === "destructive") {
    sonnerToast.error(message, options);
  } else {
    sonnerToast(message, options);
  }
}

export function useToast() {
  return { toast };
}
