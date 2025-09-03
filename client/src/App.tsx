import { useState, useEffect, useRef, useCallback } from "react";
import { RealtimeClient } from "@openai/realtime-api-beta";
// @ts-expect-error - External library without type definitions
import { WavRecorder, WavStreamPlayer } from "./lib/wavtools/index.js";
import { instructions } from "./conversation_config.js";
import "./App.css";

const clientRef = { current: null as RealtimeClient | null };
const wavRecorderRef = { current: null as WavRecorder | null };
const wavStreamPlayerRef = { current: null as WavStreamPlayer | null };

export function App() {
  const params = new URLSearchParams(window.location.search);
  const RELAY_SERVER_URL = params.get("wss");
  const [connectionStatus, setConnectionStatus] = useState<
    "disconnected" | "connecting" | "connected"
  >("disconnected");
  
  // Voice agent state for spiral animations
  const [spiralState, setSpiralState] = useState("idle");

  if (!clientRef.current) {
    clientRef.current = new RealtimeClient({
      url: RELAY_SERVER_URL || undefined,
    });
  }
  if (!wavRecorderRef.current) {
    wavRecorderRef.current = new WavRecorder({ sampleRate: 24000 });
  }
  if (!wavStreamPlayerRef.current) {
    wavStreamPlayerRef.current = new WavStreamPlayer({ sampleRate: 24000 });
  }
  
  const isConnectedRef = useRef(false);
  const connectConversation = useCallback(async () => {
    if (isConnectedRef.current) return;
    isConnectedRef.current = true;
    setConnectionStatus("connecting");
    setSpiralState("connecting");
    
    const client = clientRef.current;
    const wavRecorder = wavRecorderRef.current;
    const wavStreamPlayer = wavStreamPlayerRef.current;
    if (!client || !wavRecorder || !wavStreamPlayer) return;

    try {
      // Connect to microphone
      await wavRecorder.begin();

      // Connect to audio output
      await wavStreamPlayer.connect();

      // Connect to realtime API
      await client.connect();

      setConnectionStatus("connected");
      setSpiralState("listening");

      client.on("error", (event: unknown) => {
        console.error(event);
        setConnectionStatus("disconnected");
        setSpiralState("idle");
      });

      client.on("disconnected", () => {
        setConnectionStatus("disconnected");
        setSpiralState("idle");
      });

      client.sendUserMessageContent([
        {
          type: `input_text`,
          text: `Hello!`,
        },
      ]);

      // Always use VAD mode
      client.updateSession({
        turn_detection: { type: "server_vad" },
      });

      // Check if we're already recording before trying to pause
      if (wavRecorder.recording) {
        await wavRecorder.pause();
      }

      // Check if we're already paused before trying to record
      if (!wavRecorder.recording) {
        await wavRecorder.record((data: { mono: Float32Array }) => {
          setSpiralState("listening");
          client.appendInputAudio(data.mono);
        });
      }
    } catch (error) {
      console.error("Connection error:", error);
      setConnectionStatus("disconnected");
      setSpiralState("idle");
    }
  }, []);

  const errorMessage = !RELAY_SERVER_URL
    ? 'Missing required "wss" parameter in URL'
    : (() => {
        try {
          new URL(RELAY_SERVER_URL);
          return null;
        } catch {
          return 'Invalid URL format for "wss" parameter';
        }
      })();

  /**
   * Core RealtimeClient and audio capture setup
   * Set all of our instructions, tools, events and more
   */
  useEffect(() => {
    // Only run the effect if there's no error
    if (!errorMessage) {
      connectConversation();
      const wavStreamPlayer = wavStreamPlayerRef.current;
      const client = clientRef.current;
      if (!client || !wavStreamPlayer) return;

      // Set instructions
      client.updateSession({ instructions: instructions });

      // handle realtime events from client + server for event logging
      client.on("error", (event: unknown) => console.error(event));
      client.on("conversation.interrupted", async () => {
        const trackSampleOffset = await wavStreamPlayer.interrupt();
        if (trackSampleOffset?.trackId) {
          const { trackId, offset } = trackSampleOffset;
          await client.cancelResponse(trackId, offset);
        }
      });
      client.on("conversation.updated", async ({ item, delta }: { item: any; delta: any }) => {
        client.conversation.getItems();
        
        if (delta?.audio) {
          setSpiralState("speaking");
          wavStreamPlayer.add16BitPCM(delta.audio, item.id);
        }
        
        if (item.status === "completed" && item.formatted.audio?.length) {
          const wavFile = await WavRecorder.decode(
            item.formatted.audio,
            24000,
            24000
          );
          item.formatted.file = wavFile;
          
          // Reset to listening state after speaking
          setTimeout(() => {
            setSpiralState("listening");
          }, 1000);
        }
      });

      return () => {
        client.reset();
      };
    }
  }, [errorMessage]);

  // Get status display text
  const getStatusText = () => {
    if (errorMessage) return "Error";
    if (connectionStatus === "connecting") return "Connecting...";
    if (connectionStatus === "connected") {
      if (spiralState === "listening") return "Listening...";
      if (spiralState === "speaking") return "Speaking...";
      if (spiralState === "processing") return "Processing...";
      return "Connected";
    }
    return "Disconnected";
  };

  return (
    <div className="app-container">
      <div className="voice-agent-container">
        {/* Semi-spiral visualization */}
        <div className={`semi-spiral ${spiralState}`}>
          <div className="spiral-path">
            <div className="spiral-segment spiral-segment-1"></div>
            <div className="spiral-segment spiral-segment-2"></div>
            <div className="spiral-segment spiral-segment-3"></div>
            <div className="spiral-segment spiral-segment-4"></div>
          </div>
        </div>
        
        {/* Minimal status text */}
        <div className="status-text">
          {getStatusText()}
        </div>
      </div>
    </div>
  );
}

export default App;
