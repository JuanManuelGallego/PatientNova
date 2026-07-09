import { userRepository } from './user.repository.js';
import { logger } from '../utils/logger.js';
import type { CreateUserDto, UpdateUserDto } from './user.schemas.js';

export const userService = {
  findById: userRepository.findById.bind(userRepository),
  findMany: userRepository.findMany.bind(userRepository),

  async create(dto: CreateUserDto) {
    const user = await userRepository.create(dto);
    logger.info({ userId: user.id, email: user.email }, 'User created');
    return user;
  },

  async update(id: string, dto: UpdateUserDto) {
    const user = await userRepository.update(id, dto);
    logger.info({ userId: id, fields: Object.keys(dto) }, 'User updated');
    return user;
  },

  async delete(id: string) {
    const user = await userRepository.delete(id);
    logger.info({ userId: id }, 'User deleted');
    return user;
  },

  async restore(id: string) {
    const user = await userRepository.restore(id);
    logger.info({ userId: id }, 'User restored');
    return user;
  },
};
