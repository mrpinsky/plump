export interface StringIndexed<T> {
    [index: string]: T;
}
export interface NumericIDed {
    $id: number;
}
export declare type Attribute = number | string | boolean | Date | string[];
export declare type Attributes = StringIndexed<Attribute>;
export interface RelationshipSchema {
    sides: StringIndexed<{
        otherType: string;
        otherName: string;
    }>;
    extras?: StringIndexed<any>;
    storeData?: {
        sql?: {
            tableName: string;
            joinFields: StringIndexed<string>;
        };
    } & StringIndexed<any>;
}
export interface RelationshipItem {
    id: number | string;
    meta?: StringIndexed<number | string>;
}
export interface RelationshipDelta {
    op: 'add' | 'modify' | 'remove';
    data: RelationshipItem;
}
export interface ModelSchema {
    idAttribute: string;
    name: string;
    attributes: {
        [attrName: string]: {
            type: 'number' | 'string' | 'boolean' | 'date' | 'array' | 'object';
            readOnly?: boolean;
            default?: number | string | boolean | Date | string[];
        };
    };
    relationships: {
        [relName: string]: {
            type: RelationshipSchema;
            readOnly?: boolean;
        };
    };
    storeData?: StringIndexed<any> & {
        sql?: {
            bulkQuery: string;
            tableName: string;
        };
    };
}
export interface ModelReference {
    typeName: string;
    id: number | string;
}
export interface IndefiniteModelData {
    typeName: string;
    id?: number | string;
    attributes?: StringIndexed<Attribute>;
    relationships?: StringIndexed<RelationshipItem[]>;
}
export interface ModelData extends IndefiniteModelData {
    id: number | string;
}
export interface ModelDelta extends ModelData {
    invalidate: string[];
}
export interface DirtyValues {
    attributes?: StringIndexed<Attribute>;
    relationships?: StringIndexed<RelationshipDelta[]>;
}
export interface DirtyModel extends DirtyValues {
    id?: string | number;
    typeName: string;
}