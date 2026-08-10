"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    SpeechRecognition: any;
    webkitSpeechRecognition: any;
  }
}

export default function AudioRecorder({
  onTranscriptChange,
}: {
  onTranscriptChange: (text: string) => void;
}) {
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(true);
  const recognitionRef = useRef<any>(null);
  const finalTextRef = useRef("");

  useEffect(() => {
    const Impl =
      typeof window !== "undefined" &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (!Impl) {
      setSupported(false);
      return;
    }

    const recognition = new Impl();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = finalTextRef.current;
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          final += transcript;
        } else {
          interim += transcript;
        }
      }
      finalTextRef.current = final;
      onTranscriptChange((final + interim).trim());
    };

    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function start() {
    if (!recognitionRef.current) return;
    finalTextRef.current = "";
    onTranscriptChange("");
    recognitionRef.current.start();
    setListening(true);
  }

  function stop() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  if (!supported) {
    return (
      <div className="text-textTertiary text-xs">
        Live voice input isn&apos;t supported in this browser — just type the lane below.
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={listening ? stop : start}
      className={`rec-ring ${listening ? "recording" : ""} flex items-center justify-center`}
      aria-label={listening ? "Stop listening" : "Click to speak"}
      title={listening ? "Stop listening" : "Click to speak"}
    >
      <span className="text-2xl">{listening ? "⏹" : "🎙️"}</span>
    </button>
  );
}
