import useSWR from 'swr';

import { API_URL } from '@utils/constraints/API_URL';
import { getFetcher } from '@utils/fetcher';

export const useOtherUserData = (userID?: string) => {
  const { data: otherUserData, ...rest } = useSWR(
    userID ? API_URL.USER.GET_OTHER_USER_DATA(userID) : null,
    getFetcher,
  );

  return { otherUserData, ...rest };
};
