import Link from "next/link";
import { BookOpen } from "lucide-react";

export function Brand() {
  return <Link href="/" className="brand" aria-label="LinguaCompanion · Trang chủ">
    <span className="brand-symbol"><BookOpen size={21} strokeWidth={2.1}/></span>
    <span>Lingua<span className="brand-light">Companion</span></span>
  </Link>;
}
