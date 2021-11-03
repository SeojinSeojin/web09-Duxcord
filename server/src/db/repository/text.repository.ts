import { EntityRepository, Repository } from 'typeorm';
import { Text } from '../../entity/text.entity';

@EntityRepository(Text)
export class TextRepository extends Repository<Text> {
  findTextsByPages(textChannelId: string, page: number) {
    return this.createQueryBuilder('text')
      .where('text.textChannel = :id', { id: textChannelId })
      .leftJoinAndSelect('text.user', 'user')
      .select([
        'text.id',
        'text.content',
        'text.createdAt',
        'text.updatedAt',
        'user.id',
        'user.username',
        'user.thumbnail',
      ])
      .orderBy('text.createdAt', 'DESC')
      .skip(3 * (page - 1))
      .take(3)
      .getMany();
  }
}
