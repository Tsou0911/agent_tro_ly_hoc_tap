import Link from "next/link";
import { BookOpen, Flag, GraduationCap, Headphones, Layers3, MessagesSquare, NotebookPen, RotateCcw, School } from "lucide-react";
import { Brand } from "@/components/brand";
import { Button } from "@/components/ui/button";
import { PhraseCard } from "@/components/phrase-card";

const steps = [
  {name: "Plan", title:"Lên kế hoạch", description: "Chọn mục tiêu cho tuần học và thống nhất cùng giáo viên cách theo dõi tiến độ.", Icon: Flag, tone:"mint"},
  {name: "Do", title:"Luyện tập", description: "Luyện nghe, nói, viết và hỏi gia sư AI ngay trên tài liệu của lớp.", Icon: Headphones, tone:"peach"},
  {name: "Reflect", title:"Nhìn lại", description: "Xem kết quả thực tế, ghi lại điều đã học và chọn bước tiếp theo.", Icon: RotateCcw, tone:"lilac"},
];
export default function Home() {
  return <div className="home">
    <header className="site-header"><div className="bar"><Brand/>
      <nav aria-label="Điều hướng chính"><Link href="#phuong-phap">Phương pháp</Link><Link href="#lop-hoc">Lớp học</Link></nav>
      <div className="header-actions"><Link className="login-link" href="/login">Đăng nhập</Link><Button asChild size="sm"><Link href="/register">Tạo tài khoản</Link></Button></div>
    </div></header>
    <main id="main-content">
      <section className="hero wrap">
        <div className="hero-copy">
          <div className="eyebrow"><span/> PLAN · DO · REFLECT</div>
          <h1>Học ngoại ngữ,<br/><em>theo nhịp riêng.</em></h1>
          <p>Từ mục tiêu đầu tuần đến câu nói đầu tiên. Cùng giáo viên và gia sư AI biến tài liệu của lớp thành những buổi luyện tập mỗi ngày.</p>
          <div className="hero-actions"><Button asChild size="lg"><Link href="/register"><GraduationCap size={20}/> Bắt đầu học</Link></Button>
          <Button asChild size="lg" variant="outline"><Link href="/login"><School size={18}/> Vào lớp học</Link></Button></div>
        </div>
        <PhraseCard/>
      </section>
      <section className="method wrap" id="phuong-phap">
        <div className="section-line"><h2>Một tuần học cùng Lingua</h2><span/></div>
        <div className="step-grid">{steps.map(({Icon, tone, name, title, description})=><article className={"step "+tone} key={name}>
          <div className="step-top"><span className="step-icon"><Icon size={23}/></span><span className="step-name">{name}</span></div>
          <h3>{title}</h3><p>{description}</p>
        </article>)}</div>
      </section>
      <section className="role-section wrap" id="lop-hoc">
        <div className="section-line"><h2>Không gian lớp học</h2><span/></div>
        <div className="role-grid">
          <article><GraduationCap/><h3>Dành cho sinh viên</h3><p>Tham gia lớp bằng mã hoặc QR, luyện theo mục tiêu và nhận phản hồi cho từng bài làm.</p><Link href="/register?role=student"><BookOpen size={16}/> Tạo tài khoản sinh viên</Link></article>
          <article><NotebookPen/><h3>Dành cho giáo viên</h3><p>Chia sẻ tài liệu, giao bài kiểm tra và theo dõi những sinh viên cần được hỗ trợ.</p><Link href="/register?role=teacher"><Layers3 size={16}/> Tạo tài khoản giáo viên</Link></article>
        </div>
      </section>
    </main>
    <footer className="wrap home-footer"><Brand/><span><MessagesSquare size={16}/> Plan · Do · Reflect</span></footer>
  </div>;
}
