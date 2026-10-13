import { Column, DataType, Model, Table } from 'sequelize-typescript';

/**
 * Model de exemplo. Duas regras que o template cobra:
 * - `type` explícito em toda coluna: não dependemos de `design:type`.
 * - o schema real vem de `migrations/`; `test/schema-parity.e2e-spec.ts` falha se um
 *   model citar coluna que nenhuma migration cria.
 */
@Table({ tableName: 'items', underscored: true, timestamps: true })
export class Item extends Model {
  @Column({ type: DataType.UUID, primaryKey: true, defaultValue: DataType.UUIDV4 })
  id: string;

  @Column({ type: DataType.STRING(200), allowNull: false })
  name: string;

  @Column({ type: DataType.BOOLEAN, allowNull: false, defaultValue: false })
  done: boolean;
}
