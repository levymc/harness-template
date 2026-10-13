import { NotFoundException } from '@nestjs/common';
import { getModelToken } from '@nestjs/sequelize';
import { Test } from '@nestjs/testing';
import { Item } from './item.model.js';
import { ItemsService } from './items.service.js';

describe('ItemsService', () => {
  const model = { findByPk: vi.fn(), create: vi.fn(), findAll: vi.fn() };
  let service: ItemsService;

  beforeEach(async () => {
    vi.resetAllMocks();
    const moduleRef = await Test.createTestingModule({
      providers: [ItemsService, { provide: getModelToken(Item), useValue: model }],
    }).compile();
    service = moduleRef.get(ItemsService);
  });

  it('get de id inexistente vira 404, não null', async () => {
    model.findByPk.mockResolvedValue(null);
    await expect(service.get('00000000-0000-0000-0000-000000000000')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('create grava só o nome — done começa false pelo default do banco', async () => {
    model.create.mockResolvedValue({ id: 'x', name: 'a', done: false });
    await service.create({ name: 'a' });
    expect(model.create).toHaveBeenCalledWith({ name: 'a' });
  });
});
