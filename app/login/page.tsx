import { Suspense } from "react";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center bg-[#f8f5ef]">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#a34f3d] border-t-transparent" />
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
