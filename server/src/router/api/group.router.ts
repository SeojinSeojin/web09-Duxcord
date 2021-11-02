import { Router } from 'express';
import groupController from '../../controller/group.controller';
import { accessControl } from '../../util';
export const groupRouter = Router();

groupRouter.post('/create', accessControl({ signIn: true }), groupController.createGroup);
