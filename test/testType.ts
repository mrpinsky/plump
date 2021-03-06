import {
  ModelSchema,
  RelationshipSchema,
  Model,
  ModelData,
  Schema,
  RelationshipItem,
} from '../src/index';

export const ChildrenSchema: RelationshipSchema = {
  sides: {
    parents: { otherType: 'tests', otherName: 'children' },
    children: { otherType: 'tests', otherName: 'parents' },
  },
  storeData: {
    sql: {
      tableName: 'parent_child_relationship',
      joinFields: {
        parents: 'child_id',
        children: 'parent_id',
      },
    },
  }
};

export const ValenceChildrenSchema: RelationshipSchema = {
  sides: {
    valenceParents: { otherType: 'tests', otherName: 'valenceChildren' },
    valenceChildren: { otherType: 'tests', otherName: 'valenceParents' },
  },
  storeData: {
    sql: {
      tableName: 'valence_children',
      joinFields: {
        valenceParents: 'child_id',
        valenceChildren: 'parent_id',
      },
    },
  },
  extras: {
    perm: {
      type: 'number',
    },
  },
};

export const QueryChildrenSchema: RelationshipSchema = {

  sides: {
    queryParents: { otherType: 'tests', otherName: 'queryChildren' },
    queryChildren: { otherType: 'tests', otherName: 'queryParents' },
  },
  storeData: {
    sql: {
      tableName: 'query_children',
      joinFields: {
        queryParents: 'child_id',
        queryChildren: 'parent_id',
      },
      joinQuery: {
        queryParents: `select array_agg(
          jsonb_build_object('id', "query_children"."parent_id", 'meta', json_build_object('perm', "query_children"."perm"))
        ) from "query_children" where "tests"."id" = "query_children"."child_id" and "query_children"."perm" >= 2`,
        queryChildren: `select array_agg(
          jsonb_build_object('id', "query_children"."child_id", 'meta', json_build_object('perm', "query_children"."perm"))
        ) from "query_children" where "tests"."id" = "query_children"."parent_id" and "query_children"."perm" >= 2`,
      },
      where: {
        queryParents: '"query_children"."child_id" = ? and "query_children"."perm" >= 2',
        queryChildren: '"query_children"."parent_id" = ? and "query_children"."perm" >= 2',
      },
    },
  },
  extras: {
    perm: {
      type: 'number',
    },
  },
};

export const TestSchema: ModelSchema = {
  name: 'tests',
  idAttribute: 'id',
  attributes: {
    id: { type: 'number', readOnly: true },
    name: { type: 'string', readOnly: false },
    otherName: { type: 'string', default: '', readOnly: false },
    extended: { type: 'object', default: {}, readOnly: false },
  },
  relationships: {
    children: { type: ChildrenSchema },
    parents: { type: ChildrenSchema },
    valenceChildren: { type: ValenceChildrenSchema },
    valenceParents: { type: ValenceChildrenSchema },
    queryChildren: { type: QueryChildrenSchema, readOnly: true },
    queryParents: { type: QueryChildrenSchema, readOnly: true },
  },
  storeData: {
    sql: {
      tableName: 'tests',
      bulkQuery: 'where "tests"."id" >= ?',
    },
  }
};

export interface PermRelationshipItem extends RelationshipItem {
  meta: {
    perm: number;
  };
}

export interface TestData extends ModelData {
  type: 'tests';
  id: number;
  attributes?: {
    id: number;
    name: string;
    otherName: string;
    extended: { [key: string]: any };
  };
  relationships?: {
    children: RelationshipItem[];
    parents: RelationshipItem[];
    valenceChildren: PermRelationshipItem[];
    valenceParents: PermRelationshipItem[];
    queryChildren: PermRelationshipItem[];
    queryParents: PermRelationshipItem[];
  };
}

@Schema(TestSchema)
export class TestType extends Model<TestData> {
  static type = 'tests';
}
