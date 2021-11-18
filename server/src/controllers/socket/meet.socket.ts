import {
  io,
  meetingMembers,
  socketToMeeting,
  userConnectionInfo,
} from '../../loaders/socket.loader';
import ConnectionEvent from '../../types/socket/ConnectionEvent';
import MeetEvent from '../../types/socket/MeetEvent';
import RoomPrefix from '../../types/socket/RoomPrefix';

function SocketMeetController(socket) {
  const checkMeetingUserList = (meetingchannelList) => {
    const meetingUserList = {};
    Object.entries(meetingMembers).forEach(([channel, user]) => {
      const channelID = Number(channel);
      if (!meetingchannelList?.includes(channelID)) return;
      meetingUserList[channelID] = user;
    });
    return meetingUserList;
  };

  this.meetChat = ({ channelID, chat }) => {
    io.to(RoomPrefix.meeting + channelID).emit(MeetEvent.meetChat, chat);
  };

  this.joinMeeting = (meetingID, code, { loginID, username, thumbnail, mic, cam }) => {
    socket.join(RoomPrefix.RTC + meetingID);
    socketToMeeting[socket.id] = meetingID;
    const newMember = {
      socketID: socket.id,
      loginID,
      username,
      thumbnail,
      mic,
      cam,
    };

    if (meetingID in meetingMembers) {
      const memberList = meetingMembers[meetingID].map((member) => member.socketID);
      if (memberList.includes(newMember.socketID)) return;
      meetingMembers[meetingID].push(newMember);
    } else {
      meetingMembers[meetingID] = [newMember];
    }

    const membersInMeeting = meetingMembers[meetingID].filter(
      (user) => user.socketID !== socket.id,
    );
    io.to(code).emit(MeetEvent.someoneIn, meetingMembers[meetingID], meetingID);
    io.to(socket.id).emit(MeetEvent.allMeetingMembers, membersInMeeting);
  };

  this.answer = ({ answer, receiverID }) => {
    io.to(receiverID).emit(MeetEvent.answer, { answer, senderID: socket.id });
  };

  this.offer = ({ offer, receiverID, member }) => {
    io.to(receiverID).emit(MeetEvent.offer, { offer, member: { socketID: socket.id, ...member } });
  };

  this.candidate = ({ candidate, receiverID }) => {
    io.to(receiverID).emit(MeetEvent.candidate, { candidate, senderID: socket.id });
  };

  this.mute = (meetingID, muted, who) => {
    const meetingChannel = Object.keys(meetingMembers).find((v) => v === meetingID?.toString());
    if (!meetingChannel) return;
    const index = meetingMembers[meetingID.toString()].findIndex(
      (oneMember) => oneMember.loginID === who,
    );
    if (index === -1) return;
    meetingMembers[meetingID.toString()][index].mic = muted;
    io.to(RoomPrefix.RTC + meetingID).emit(MeetEvent.setMuted, who, muted);
  };

  this.toggleCam = (meetingID, toggleCam, who) => {
    const meetingChannel = Object.keys(meetingMembers).find((v) => v === meetingID?.toString());
    if (!meetingChannel) return;
    const index = meetingMembers[meetingID.toString()].findIndex(
      (oneMember) => oneMember.loginID === who,
    );
    meetingMembers[meetingID.toString()][index].cam = toggleCam;
    io.to(RoomPrefix.RTC + meetingID).emit(MeetEvent.setToggleCam, who, toggleCam);
  };

  this.speaker = (meetingID, speaker, who) => {
    const meetingChannel = Object.keys(meetingMembers).find((v) => v === meetingID?.toString());
    if (!meetingChannel) return;
    const index = meetingMembers[meetingID.toString()].findIndex(
      (oneMember) => oneMember.loginID === who,
    );
    meetingMembers[meetingID.toString()][index].speaker = speaker;
    io.to(RoomPrefix.RTC + meetingID).emit(MeetEvent.setSpeaker, who, speaker);
  };

  this.leaveMeeting = (groupCode) => {
    const meetingID = socketToMeeting[socket.id];
    if (meetingMembers[meetingID])
      meetingMembers[meetingID] = meetingMembers[meetingID].filter(
        (member) => member.socketID !== socket.id,
      );

    if (groupCode === ConnectionEvent.close) {
      const groupCode = Object.keys(userConnectionInfo).find((key) =>
        userConnectionInfo[key].some((v) => v.socketID === socket.id),
      );
      io.to(groupCode).emit(MeetEvent.someoneOut, meetingMembers[meetingID], meetingID);
    } else {
      io.to(groupCode).emit(MeetEvent.someoneOut, meetingMembers[meetingID], meetingID);
    }
    io.to(RoomPrefix.RTC + meetingID).emit(MeetEvent.leaveMember, socket.id);
  };

  this.meetingChannelUserList = (code, meetingchannelList) => {
    const meetingUserList = checkMeetingUserList(meetingchannelList);
    io.to(socket.id).emit(MeetEvent.MeetingUserList, meetingUserList);
  };
}

export default SocketMeetController;
