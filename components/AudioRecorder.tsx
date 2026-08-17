"use client";

import { useEffect, useRef, useState } from "react";
import { correctCityNames } from "./correctCityNames";

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
    recognition.maxAlternatives = 3; // gives us alternates to check against city list

    recognition.onresult = (event: any) => {
      let interim = "";
      let final = finalTextRef.current;

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];

        // check all alternatives, prefer one that best matches a known city
        const bestAlt = pickBestAlternative(result);

        if (result.isFinal) {
          final += correctCityNames(bestAlt) + " ";
        } else {
          interim += bestAlt;
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

  function pickBestAlternative(result: any) {
    // among the N alternatives Chrome gives us, pick the one
    // that's closest to a real city name if any are close
    let best = result[0].transcript;
    let bestScore = Infinity;
    for (let a = 0; a < result.length; a++) {
      const scored = correctCityNames(result[a].transcript, true);
      if (scored.distance < bestScore) {
        bestScore = scored.distance;
        best = scored.text;
      }
    }
    return best;
  }

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