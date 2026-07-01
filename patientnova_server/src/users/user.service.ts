import { userRepository } from './user.repository.js';
import type { CreateUserDto, UpdateUserDto } from './user.schemas.js';

export const userService = {
  findById: userRepository.findById.bind(userRepository),
  findMany: userRepository.findMany.bind(userRepository),

  async create(dto: CreateUserDto) {
    return userRepository.create(dto);
  },

  async update(id: string, dto: UpdateUserDto) {
    return userRepository.update(id, dto);
  },

  async changePassword(id: string, currentPassword: string, newPassword: string) {
    return userRepository.changePassword(id, currentPassword, newPassword);
  },

  async delete(id: string) {
    return userRepository.delete(id);
  },

  async restore(id: string) {
    return userRepository.restore(id);
  },
};
