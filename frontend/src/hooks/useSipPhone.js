import { useRef, useCallback, useState } from 'react';
import { UserAgent, Registerer, SessionState } from 'sip.js';
import { ASTERISK_WS } from '../services/apiService';

export function useSipPhone() {
  const uaRef = useRef(null);
  const sessionRef = useRef(null);
  const [sipState, setSipState] = useState('unregistered'); // unregistered | registered | calling | active

  const register = useCallback(async () => {
    if (uaRef.current) return;

    const ua = new UserAgent({
      uri: UserAgent.makeURI('sip:webphone@asterisk'),
      transportOptions: { server: ASTERISK_WS },
      authorizationUsername: 'webphone',
      authorizationPassword: 'webphone_2024!',
      logLevel: 'warn',
      sessionDescriptionHandlerFactoryOptions: {
        constraints: { audio: true, video: false },
        peerConnectionConfiguration: {
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
        },
      },
    });

    uaRef.current = ua;

    ua.delegate = {
      onInvite: (invitation) => {
        sessionRef.current = invitation;
        setSipState('calling');
        invitation.stateChange.addListener((state) => {
          if (state === SessionState.Established) setSipState('active');
          if (state === SessionState.Terminated) {
            sessionRef.current = null;
            setSipState('registered');
          }
        });
      },
    };

    await ua.start();
    const registerer = new Registerer(ua);
    await registerer.register();
    setSipState('registered');
  }, []);

  const acceptSip = useCallback(async (audioElement) => {
    const inv = sessionRef.current;
    if (!inv) return;
    await inv.accept();
    if (audioElement && inv.sessionDescriptionHandler?.peerConnection) {
      const pc = inv.sessionDescriptionHandler.peerConnection;
      pc.ontrack = (evt) => {
        audioElement.srcObject = evt.streams[0];
      };
    }
    setSipState('active');
  }, []);

  const hangupSip = useCallback(async () => {
    const s = sessionRef.current;
    if (!s) return;
    if (s.state === SessionState.Established) await s.bye();
    else await s.reject();
    sessionRef.current = null;
    setSipState('registered');
  }, []);

  return { sipState, register, acceptSip, hangupSip };
}
