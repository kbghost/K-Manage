import { useEffect, useRef, useState } from "react";
import { Modal } from "./ui";

type Detector = { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> };
declare global { interface Window { BarcodeDetector?: new (o?: { formats: string[] }) => Detector } }
export const cameraScanSupported = () => typeof window !== "undefined" && !!window.BarcodeDetector && !!navigator.mediaDevices?.getUserMedia;

/** Lecture par camera (API BarcodeDetector : Chrome/Edge/Android). Une douchette USB, elle, agit comme un clavier. */
export function BarcodeScannerModal({ open, onClose, onCode }: { open: boolean; onClose: () => void; onCode: (code: string) => void }) {
  const video = useRef<HTMLVideoElement>(null); const [error, setError] = useState("");
  useEffect(() => {
    if (!open) return;
    let stop = false; let stream: MediaStream | undefined; let timer: ReturnType<typeof setInterval> | undefined;
    (async () => {
      try {
        if (!cameraScanSupported()) throw new Error("La lecture par camera n'est pas disponible sur ce navigateur. Utilisez une douchette ou saisissez le code.");
        const det = new window.BarcodeDetector!({ formats: ["ean_13", "ean_8", "code_128", "upc_a", "upc_e", "qr_code"] });
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (stop || !video.current) return;
        video.current.srcObject = stream; await video.current.play();
        timer = setInterval(async () => { try { const r = await det.detect(video.current!); if (r[0]) { onCode(r[0].rawValue); onClose(); } } catch { /* image non lisible */ } }, 400);
      } catch (e) { setError(e instanceof Error ? e.message : "Camera inaccessible"); }
    })();
    return () => { stop = true; if (timer) clearInterval(timer); stream?.getTracks().forEach((t) => t.stop()); setError(""); };
  }, [open, onClose, onCode]);
  return (
    <Modal open={open} onClose={onClose} title="Scanner un code-barres" size="sm">
      {error ? <p role="alert" className="text-sm text-red-600">{error}</p> : <video ref={video} muted playsInline className="aspect-video w-full rounded-lg bg-black" />}
    </Modal>
  );
}
