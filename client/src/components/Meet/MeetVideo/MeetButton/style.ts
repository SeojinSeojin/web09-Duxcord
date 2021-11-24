import styled from 'styled-components';
import Colors from '@styles/Colors';

const MeetButtonWrapper = styled.div`
  position: absolute;
  left: 50%;
  bottom: 10px;
  transform: translateX(-50%);
  display: flex;
  justify-content: center;
`;

const MeetButton = styled.button`
  width: 60px;
  height: 60px;
  border: none;
  border-radius: 50%;
  margin: 10px;
  cursor: pointer;
`;

const GrayButton = styled(MeetButton)`
  background-color: ${Colors.Gray1};
`;

const DarkRedButton = styled(MeetButton)`
  background-color: ${Colors.DarkRed};
`;

export { MeetButtonWrapper, GrayButton, DarkRedButton };
