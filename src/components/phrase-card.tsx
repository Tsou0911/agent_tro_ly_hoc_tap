"use client";
import Image from "next/image";
import { useState } from "react";
import { AudioLines, BookOpen, RotateCw, Volume2 } from "lucide-react";

export function PhraseCard() {
  const [flipped, setFlipped] = useState(false);
  const [status, setStatus] = useState("");
  function listen() {
    if (!("speechSynthesis" in window)) {
      setStatus("Trình duyệt này chưa hỗ trợ phát âm.");
      return;
    }
    window.speechSynthesis.cancel();
    const phrase = new SpeechSynthesisUtterance("Bonjour !");
    phrase.lang = "fr-FR";
    phrase.rate = 0.85;
    phrase.onstart = () => setStatus("Đang phát âm…");
    phrase.onend = () => setStatus("");
    phrase.onerror = () => setStatus("Giọng đọc tiếng Pháp chưa sẵn sàng.");
    window.speechSynthesis.speak(phrase);
  }
  return <div className="lesson-board">
    <div className="board-top"><AudioLines size={16}/> Góc luyện nói</div>
    <div className="card-stack">
      <div className="paper-back" aria-hidden="true"/>
      <article className="phrase-card">
        <div className="phrase-meta"><BookOpen size={14}/> THẺ HỘI THOẠI <span>FR / VI</span></div>
        <div className="cafe-image"><Image src="/cafe-paris.webp" alt="Quán cà phê góc phố Paris với mái hiên sọc đỏ" fill sizes="(max-width: 600px) 76vw, 330px" priority/></div>
        <div className="phrase-word"><div><span>{flipped ? "Tiếng Việt" : "Français"}</span><strong>{flipped ? "Xin chào!" : "Bonjour !"}</strong></div>
          <button type="button" onClick={listen} aria-label="Nghe phát âm Bonjour"><Volume2 size={20}/></button>
        </div>
      </article>
    </div>
    <button className="flip-card" type="button" onClick={() => setFlipped(!flipped)}><RotateCw size={15}/> {flipped ? "Xem tiếng Pháp" : "Lật thẻ xem nghĩa"}</button>
    <span role="status" className="voice-status">{status}</span>
  </div>;
}
