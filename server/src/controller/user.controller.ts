import { compare, hash } from 'bcryptjs';
import { NextFunction, Request, Response } from 'express';
import { groupMemberRepository, userRepository } from '../db';
import { User } from '../entity/user.entity';

declare module 'express-session' {
  interface SessionData {
    userID: number;
  }
}

const saltRounds = 10;
const nullCheck = (data) => data !== undefined && data !== null && data !== '';

const signUp = async (req: Request, res: Response, next: NextFunction) => {
  const { loginID, username, password } = req.body;

  try {
    if (![loginID, username, password].every((data) => nullCheck(data)))
      return res.status(400).send('회원가입에 필요한 데이터일부가 누락되었습니다.');

    const isUsedID = await userRepository.findOne({ where: { loginID: loginID } });
    if (isUsedID) return res.status(400).send('이미 사용중인 ID 입니다.');

    const newUser = new User();
    newUser.loginID = loginID;
    newUser.username = username;
    newUser.password = await hash(password, saltRounds);
    await userRepository.save(newUser);

    return res.status(200).send('회원가입에 성공했습니다.');
  } catch (error) {
    next(error);
  }
};

const signIn = async (req: Request, res: Response, next: NextFunction) => {
  const { loginID, password } = req.body;

  try {
    const user = await userRepository.findOne({ where: { loginID: loginID } });
    if (!user) return res.status(400).send('존재하지 않는 회원입니다.');

    const isPasswordValid = await compare(password, user.password);
    if (!isPasswordValid) return res.status(400).send('비밀번호가 올바르지 않습니다.');

    req.session.userID = user.id;
    return res.status(200).send('로그인 성공!');
  } catch (error) {
    next(error);
  }
};

const signOut = (req: Request, res: Response, next: NextFunction) => {
  return req.session.destroy((error) => {
    if (error) return next(error);
    return res.status(200).send('로그아웃 성공!');
  });
};

const getUserData = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userID } = req.session;
    const userdata = await userRepository.findByID(userID);

    return res.status(200).json(userdata);
  } catch (error) {
    next(error);
  }
};

const getUserGroups = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userID } = req.session;
    const userdata = await userRepository.findByID(userID);
    if (!userdata) return res.status(400).send('존재하지 않는 유저입니다.');

    const groups = await groupMemberRepository
      .createQueryBuilder('group_member')
      .where('group_member.userId = :id', { id: userID })
      .leftJoinAndSelect('group_member.group', 'group')
      .select([
        'group_member.lastAccessTime',
        'group.id',
        'group.name',
        'group.thumbnail',
        'group.code',
      ])
      .getMany();

    return res.status(200).json({ groups });
  } catch (error) {
    next(error);
  }
};

export default {
  signUp,
  signIn,
  signOut,
  getUserData,
  getUserGroups,
};
