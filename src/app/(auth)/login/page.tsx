import { AuthForm } from "@/components/auth-form";
import { vi } from "@/lib/i18n/vi";
export const metadata={title:vi.auth.loginTitle};
export default async function Login({searchParams}:{searchParams:Promise<{next?:string;confirm?:string}>}) {
  const params=await searchParams;
  return <AuthForm next={params.next} confirm={params.confirm === "retry"}/>;
}
