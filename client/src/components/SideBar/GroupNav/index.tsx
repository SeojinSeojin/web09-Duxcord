import React, { useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { useHistory } from 'react-router';
import { mutate } from 'swr';

import { setSelectedChannel } from '@redux/selectedChannel/slice';
import { setSelectedGroup } from '@redux/selectedGroup/slice';
import { setSelectedChat } from '@redux/selectedChat/slice';
import {
  addUserConnection,
  removeUserConnection,
  setGroupConnection,
} from '@redux/groupConnection/slice';
import { useGroups, useSelectedGroup } from '@hooks/index';
import { ModalController } from '@customTypes/modal';
import GroupEvent from '@customTypes/socket/GroupEvent';
import { API_URL } from 'src/api/API_URL';
import { URL } from 'src/api/URL';
import { socket } from 'src/utils/socket';
import GroupCreateModal from '@components/Modal/GroupCreate';
import GroupAddModal from '@components/Modal/GroupAdd';
import GroupJoinModal from '@components/Modal/GroupJoin';
import { GroupAddIcon } from '@components/common/Icons';
import {
  GroupListWrapper,
  GroupList,
  GroupWrapper,
  GroupItem,
  GroupListDivider,
  AddGroupButton,
} from './style';
import { Group } from '@customTypes/group';

function GroupNav() {
  const { groups, mutate: mutateGroups } = useGroups();
  const selectedGroup = useSelectedGroup();
  const dispatch = useDispatch();
  const history = useHistory();

  const [selectedModal, setSelectedModal] = useState('');
  const groupJoinModalControl: ModalController = {
    hide: () => setSelectedModal(''),
    show: () => setSelectedModal('JOIN'),
    previous: () => setSelectedModal('ADD'),
  };
  const groupCreateModalControl: ModalController = {
    hide: () => setSelectedModal(''),
    show: () => setSelectedModal('CREATE'),
    previous: () => setSelectedModal('ADD'),
  };
  const groupAddModalControl: ModalController = {
    hide: () => setSelectedModal(''),
    show: () => setSelectedModal('ADD'),
  };

  const selectGroup = (group: Group) => () => {
    history.replace(URL.groupPage(group.id));
    dispatch(setSelectedChannel({ type: '', id: null, name: '' }));
    dispatch(setSelectedGroup(group));
    socket.emit(GroupEvent.groupID, group.code);
  };

  useEffect(() => {
    socket.on(GroupEvent.groupUserConnection, (connectionList) => {
      dispatch(setGroupConnection(connectionList));
    });

    socket.on(GroupEvent.groupDelete, (code) => {
      mutateGroups(
        groups.filter((group: Group) => group.id !== selectedGroup.id),
        false,
      );
      if (code === selectedGroup?.code) {
        dispatch(setSelectedGroup(null));
        dispatch(
          setSelectedChannel({
            type: '',
            id: null,
            name: '',
          }),
        );
        dispatch(setSelectedChat(null));
        history.replace(URL.groupPage());
      }
    });

    socket.on(GroupEvent.userExit, (user, code) => {
      dispatch(removeUserConnection(user));
    });

    socket.on(GroupEvent.userEnter, (user, code) => {
      if (code === selectedGroup?.code) dispatch(addUserConnection(user));
      mutate(API_URL.group.getGroupMembers(selectedGroup?.id));
    });

    return () => {
      socket.off(GroupEvent.groupUserConnection);
      socket.off(GroupEvent.groupDelete);
      socket.off(GroupEvent.userEnter);
      socket.off(GroupEvent.userExit);
    };
  }, [dispatch, selectedGroup?.code, selectedGroup?.id]);

  return (
    <GroupListWrapper>
      <GroupList>
        {groups?.map((group: Group) => (
          <GroupWrapper name={group.name}>
            <GroupItem key={group.id} onClick={selectGroup(group)} thumbnail={group.thumbnail}>
              <p>{!group.thumbnail && group.name}</p>
            </GroupItem>
          </GroupWrapper>
        ))}
      </GroupList>
      <GroupListDivider />
      <div>
        <AddGroupButton onClick={groupAddModalControl.show}>
          <GroupAddIcon />
        </AddGroupButton>
      </div>
      {selectedModal === 'ADD' ? (
        <GroupAddModal
          controller={groupAddModalControl}
          showGroupCreate={groupCreateModalControl.show}
          showGroupJoin={groupJoinModalControl.show}
        />
      ) : selectedModal === 'JOIN' ? (
        <GroupJoinModal controller={groupJoinModalControl} />
      ) : selectedModal === 'CREATE' ? (
        <GroupCreateModal controller={groupCreateModalControl} />
      ) : null}
    </GroupListWrapper>
  );
}

export default GroupNav;
