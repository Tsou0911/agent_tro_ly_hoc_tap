"use client";
import Link from "next/link";
import { Button } from "@/components/ui/button";
export default function ErrorPage({reset}:{error:Error;reset:()=>void}) {
  return <main className="mx-auto max-w-lg space-y-5 p-8"><h1 className="text-2xl">Chưa thể tải trang</h1><p>Hãy kiểm tra kết nối và cấu hình dịch vụ trong README.md.</p><div className="flex gap-3"><Button onClick={reset}>Thử lại</Button><Button variant="outline" asChild><Link href="/">Trang chủ</Link></Button></div></main>;
}
