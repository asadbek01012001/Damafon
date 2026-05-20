import { useRef, useCallback, useState } from 'react';
import { GO2RTC_URL } from '../services/apiService';

export function useWebRTC() {
  const pcRef = useRef(null);
  const localStreamRef = useRef(null);
  const [stream, setStream] = useState(null);
  const [videoState, setVideoState] = useState('idle'); // idle | connecting | live | error

  const connect = useCallback(async (streamName = 'dahua_sub', twoWayAudio = false) => {
    if (pcRef.current) disconnect();

    setVideoState('connecting');

    const pc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
      bundlePolicy: 'max-bundle',
    });
    pcRef.current = pc;

    pc.addTransceiver('video', { direction: 'recvonly' });

    if (twoWayAudio) {
      try {
        const micStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        localStreamRef.current = micStream;
        pc.addTransceiver(micStream.getAudioTracks()[0], { direction: 'sendrecv' });
      } catch {
        pc.addTransceiver('audio', { direction: 'recvonly' });
      }
    } else {
      pc.addTransceiver('audio', { direction: 'recvonly' });
    }

    const ms = new MediaStream();
    setStream(ms);

    pc.ontrack = (evt) => {
      evt.streams[0]?.getTracks().forEach((t) => ms.addTrack(t));
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'connected') setVideoState('live');
      if (pc.connectionState === 'failed') setVideoState('error');
      if (pc.connectionState === 'closed') setVideoState('idle');
    };

    try {
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);

      await new Promise((resolve) => {
        if (pc.iceGatheringState === 'complete') { resolve(); return; }
        pc.onicegatheringstatechange = () => {
          if (pc.iceGatheringState === 'complete') resolve();
        };
        setTimeout(resolve, 3000);
      });

      const resp = await fetch(`${GO2RTC_URL}/api/webrtc?src=${streamName}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/sdp' },
        body: pc.localDescription.sdp,
      });

      if (!resp.ok) throw new Error(`go2rtc: ${resp.status}`);

      const sdp = await resp.text();
      await pc.setRemoteDescription({ type: 'answer', sdp });
    } catch (err) {
      console.error('WebRTC connect failed:', err);
      setVideoState('error');
    }
  }, []);

  const disconnect = useCallback(() => {
    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((t) => t.stop());
      localStreamRef.current = null;
    }
    if (pcRef.current) {
      pcRef.current.close();
      pcRef.current = null;
    }
    setStream(null);
    setVideoState('idle');
  }, []);

  const toggleLocalMic = useCallback((enabled) => {
    localStreamRef.current?.getAudioTracks().forEach((t) => { t.enabled = enabled; });
  }, []);

  return { stream, videoState, connect, disconnect, toggleLocalMic };
}
