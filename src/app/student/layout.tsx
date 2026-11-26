import { WorkspaceLayout } from "@/components/workspace-layout";
export const dynamic="force-dynamic";
export default function Layout({children}:{children:React.ReactNode}) {return <WorkspaceLayout role="student">{children}</WorkspaceLayout>;}
