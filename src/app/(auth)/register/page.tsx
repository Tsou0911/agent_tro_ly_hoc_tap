import { AuthForm } from "@/components/auth-form";
import { vi } from "@/lib/i18n/vi";
export const metadata={title:vi.auth.registerTitle};
export default async function Register({searchParams}:{searchParams:Promise<{next?:string;role?:string}>}) {
  const params=await searchParams;
  return <AuthForm register next={params.next} initialRole={params.role}/>;
}
