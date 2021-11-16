import { useState, useEffect, useRef, useCallback } from 'react';
import MeetEvent from '@customTypes/socket/MeetEvent';
import { useSelectedChannel, useUserdata, useUserDevice } from '@hooks/index';
import Socket, { socket } from '../../../utils/socket';
import {
  MeetVideoWrapper,
  VideoItemWrapper,
  VideoItem,
  MuteWrapper,
  CamOffWrapper,
  MyImage,
} from './style';
import { highlightMyVolume } from '../../../utils/audio';
import { MicOffIcon } from '@components/common/Icons';

const ICE_SERVER_URL = 'stun:stun.l.google.com:19302';

const pcConfig = {
  iceServers: [
    {
      urls: ICE_SERVER_URL,
    },
  ],
};

interface IMeetingUser {
  socketID: string;
  loginID: string;
  username: string;
  thumbnail: string | null;
  mic: boolean;
  cam: boolean;
  stream?: MediaStream;
  pc?: RTCPeerConnection;
}

function MeetVideo() {
  const { userdata } = useUserdata();
  const { id } = useSelectedChannel();
  const { mic, cam } = useUserDevice();
  const videoWrapperRef = useRef<HTMLDivElement>(null);
  const myVideoRef = useRef<HTMLVideoElement>(null);
  const [myStream, setMyStream] = useState<MediaStream | null>(null);
  const [meetingMembers, setMeetingMembers] = useState<IMeetingUser[]>([]);
  const pcs = useRef<{ [socketID: string]: RTCPeerConnection }>({});
  const videoCount = videoWrapperRef.current && videoWrapperRef.current.childElementCount;

  const getMyStream = async () => {
    let myStream;
    try {
      myStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: true,
      });
    } catch (e) {
      const canvas = document.createElement('canvas');
      myStream = canvas.captureStream(0);
    }
    if (myVideoRef.current) {
      myVideoRef.current.srcObject = myStream;
      highlightMyVolume(myStream, myVideoRef.current);
    }
    setMyStream(myStream);
  };

  const createPeerConnection = useCallback(
    (member: IMeetingUser) => {
      const pc = new RTCPeerConnection(pcConfig);

      pc.onicecandidate = (data) => {
        if (!data.candidate) return;

        socket.emit(MeetEvent.candidate, {
          candidate: data.candidate,
          receiverID: member.socketID,
        });
      };

      pc.ontrack = (data) => {
        setMeetingMembers((members): IMeetingUser[] => [
          ...members.filter((m: IMeetingUser) => m.socketID !== member.socketID),
          {
            ...member,
            stream: data.streams[0],
            pc,
          },
        ]);
      };

      if (myStream) {
        myStream.getTracks().forEach((track) => {
          if (myStream) pc.addTrack(track, myStream);
        });
      }
      return pc;
    },
    [myStream],
  );

  useEffect(() => {
    getMyStream();
  }, []);

  useEffect(() => {
    if (id === null || userdata === undefined) return;
    const { loginID, username, thumbnail } = userdata;

    Socket.joinChannel({ channelType: MeetEvent.meeting, id });
    socket.on(MeetEvent.allMeetingMembers, async (members) => {
      members.forEach(async (member: IMeetingUser) => {
        try {
          const pc = await createPeerConnection(member);
          if (!pc) return;
          pcs.current = { ...pcs.current, [member.socketID]: pc };
          const offer = await pc.createOffer();
          await pc.setLocalDescription(new RTCSessionDescription(offer));

          socket.emit(MeetEvent.offer, {
            offer,
            receiverID: member.socketID,
            member: { loginID, username, thumbnail, mic, cam },
          });
        } catch (e) {
          console.error(MeetEvent.allMeetingMembers, e);
        }
      });
    });

    socket.on(MeetEvent.offer, async ({ offer, member }) => {
      const pc = createPeerConnection(member);
      if (!pc) return;
      pcs.current[member.socketID] = pc;
      pc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await pc.createAnswer();
      pc.setLocalDescription(new RTCSessionDescription(answer));
      socket.emit(MeetEvent.answer, { answer, receiverID: member.socketID });
    });

    socket.on(MeetEvent.answer, ({ answer, senderID }) => {
      const pc = pcs.current[senderID];
      if (!pc) return;
      pc.setRemoteDescription(new RTCSessionDescription(answer));
    });

    socket.on(MeetEvent.candidate, async ({ candidate, senderID }) => {
      const pc = pcs.current[senderID];
      if (!pc) return;
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    });

    socket.on(MeetEvent.leaveMember, (memberID) => {
      if (!pcs.current[memberID]) return;
      pcs.current[memberID].close();
      delete pcs.current[memberID];
      setMeetingMembers((members) => members.filter((member) => member.socketID !== memberID));
    });

    socket.emit(MeetEvent.joinMeeting, id, { loginID, username, thumbnail, mic, cam });

    return () => {
      Socket.leaveChannel({ channelType: MeetEvent.meeting, id });
      socket.off(MeetEvent.allMeetingMembers);
      socket.off(MeetEvent.offer);
      socket.off(MeetEvent.answer);
      socket.off(MeetEvent.candidate);
      socket.off(MeetEvent.leaveMember);
      socket.emit(MeetEvent.leaveMeeting);

      Object.values(pcs.current).forEach((pc) => pc.close());
    };
  }, [id, userdata, createPeerConnection]);

  useEffect(() => {
    if (myStream) {
      myStream.getAudioTracks().forEach((track) => {
        track.enabled = mic;
      });
      myStream.getVideoTracks().forEach((track) => {
        track.enabled = cam;
      });
    }
  }, [mic, cam, myStream]);

  return (
    <MeetVideoWrapper ref={videoWrapperRef} videoCount={videoCount || 0}>
      <VideoItemWrapper>
        <VideoItem autoPlay playsInline muted ref={myVideoRef} />
        {cam ? (
          ''
        ) : (
          <MyImage src={userdata?.thumbnail || '/images/default_profile.png'} alt="profile" />
        )}
        <p>{userdata?.username}</p>
        {mic ? '' : <MicOffIcon />}
      </VideoItemWrapper>
      {meetingMembers.map((member) => (
        <OtherVideo key={member.socketID} member={member} />
      ))}
    </MeetVideoWrapper>
  );
}

function OtherVideo({ member }: { member: IMeetingUser }) {
  const ref = useRef<HTMLVideoElement>(null);
  const micIconRef = useRef<HTMLDivElement>(null);
  const thumbnailRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current || !member.stream) return;
    ref.current.srcObject = member.stream;
  }, [member.stream]);

  useEffect(() => {
    socket.on(MeetEvent.setMuted, (who, muted) => {
      if (member.loginID !== who) return;

      if (!muted) {
        micIconRef.current?.classList.add('mute');
      } else {
        micIconRef.current?.classList.remove('mute');
      }
    });

    socket.on(MeetEvent.setToggleCam, (who, toggleCam) => {
      if (member.loginID !== who) return;
      if (!toggleCam) {
        thumbnailRef.current?.classList.add('turnOffCam');
      } else {
        thumbnailRef.current?.classList.remove('turnOffCam');
      }
    });

    if (!member.mic) micIconRef.current?.classList.add('mute');
    if (!member.cam) thumbnailRef.current?.classList.add('turnOffCam');

    const interval = setInterval(() => {
      const receiver = member?.pc?.getReceivers().find((r: { track: { kind: string } }) => {
        return r.track.kind === 'audio';
      });
      const source = receiver?.getSynchronizationSources()[0];

      if (source?.audioLevel && source?.audioLevel > 0.001) {
        ref.current?.classList.add('saying');
      } else {
        ref.current?.classList.remove('saying');
      }
    }, 1000);
    return () => {
      socket.off(MeetEvent.setMuted);
      socket.off(MeetEvent.setToggleCam);
      clearInterval(interval);
    };
  });

  return (
    <VideoItemWrapper>
      <VideoItem key={member.socketID} autoPlay playsInline ref={ref} />
      <p>{member?.username}</p>
      <MuteWrapper ref={micIconRef}>
        <MicOffIcon />
      </MuteWrapper>
      <CamOffWrapper ref={thumbnailRef}>
        <img src={member?.thumbnail || '/images/default_profile.png'} alt="profile"></img>
      </CamOffWrapper>
    </VideoItemWrapper>
  );
}

export default MeetVideo;
