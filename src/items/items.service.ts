import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/sequelize';
import { Item } from './item.model.js';
import type { CreateItemDto } from './dto/create-item.dto.js';
import type { UpdateItemDto } from './dto/update-item.dto.js';

@Injectable()
export class ItemsService {
  constructor(@InjectModel(Item) private readonly items: typeof Item) {}

  list() {
    return this.items.findAll({ order: [['createdAt', 'ASC']] });
  }

  async get(id: string) {
    const item = await this.items.findByPk(id);
    if (!item) throw new NotFoundException(`item ${id} não existe`);
    return item;
  }

  create(dto: CreateItemDto) {
    return this.items.create({ name: dto.name });
  }

  async update(id: string, dto: UpdateItemDto) {
    const item = await this.get(id);
    return item.update(dto);
  }

  async remove(id: string) {
    const item = await this.get(id);
    await item.destroy();
  }
}
