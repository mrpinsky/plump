import { Subject, Observable } from 'rxjs';

import { Model } from './model';
import {
  ModelAttributes,
  // IndefiniteModelData,
  ModelData,
  // ModelDelta,
  // ModelSchema,
  ModelReference,
  DirtyModel,
  RelationshipItem,
  CacheStore,
  TerminalStore,
} from './dataTypes';

export class Plump {

  destroy$: Observable<string>;
  caches: CacheStore[];
  terminal: TerminalStore;

  private teardownSubject: Subject<string>;
  private types: { [type: string]: typeof Model };

  constructor() {
    this.teardownSubject = new Subject();
    this.caches = [];
    this.types = {};
    this.destroy$ = this.teardownSubject.asObservable();
  }

  addType(T: typeof Model): Promise<void> {
    if (this.types[T.type] === undefined) {
      this.types[T.type] = T;
      return Promise.all(
        this.caches.map(s => s.addSchema(T))
      ).then(() => {
        if (this.terminal) {
          this.terminal.addSchema(T);
        }
      });
    } else {
      return Promise.reject(`Duplicate Type registered: ${T.type}`);
    }
  }

  type(T: string): typeof Model {
    return this.types[T];
  }

  setTerminal(store: TerminalStore): Promise<void> {
    if (this.terminal !== undefined) {
      throw new Error('cannot have more than one terminal store');
    } else {
      store.terminal = true;
      this.terminal = store;
      this.caches.forEach((cacheStore) => {
        Plump.wire(cacheStore, store, this.destroy$);
      });
    }
    return store.addSchemas(
      Object.keys(this.types).map(k => this.types[k])
    );
  }

  addCache(store: CacheStore): Promise<void> {
    this.caches.push(store);
    if (this.terminal !== undefined) {
      Plump.wire(store, this.terminal, this.destroy$);
    }
    return store.addSchemas(
      Object.keys(this.types).map(k => this.types[k])
    );
  }

  find<T extends ModelData>(ref: ModelReference): Model<T> {
    const Type = this.types[ref.type];
    return new Type({ [Type.schema.idAttribute]: ref.id }, this);
  }

  forge<A extends ModelAttributes, T extends Model<ModelData & { attributes?: A }>>(t: string, val: Partial<A>): T {
    const Type = this.types[t];
    return new Type(val, this) as T;
  }

  teardown(): void {
    this.teardownSubject.next('done');
  }

  get<T extends ModelData>(value: ModelReference, opts: string[] = ['attributes']): Promise<T> {
    const keys = opts && !Array.isArray(opts) ? [opts] : opts;
    return this.caches.reduce((thenable, storage) => {
      return thenable.then((v) => {
        if (v !== null) {
          return v;
        } else if (storage.hot(value)) {
          return storage.read(value, keys);
        } else {
          return null;
        }
      });
    }, Promise.resolve(null))
    .then((v) => {
      if (((v === null) || (v.attributes === null)) && (this.terminal)) {
        return this.terminal.read(value, keys);
      } else {
        return v;
      }
    });
  }

  bulkGet<T extends ModelData>(value: ModelReference): Promise<T> {
    return this.terminal.bulkRead(value);
  }

  save<T extends ModelData>(value: DirtyModel): Promise<T> {
    if (this.terminal) {
      return Promise.resolve()
      .then(() => {
        // if (Object.keys(value.attributes).length > 0) {
          return this.terminal.writeAttributes({
            attributes: value.attributes,
            id: value.id,
            type: value.type,
          });
        // } else {
          // return {
            // id: value.id,
            // type: value.type,
          // };
        // }
      })
      .then((updated) => {
        if (value.relationships && Object.keys(value.relationships).length > 0) {
          return Promise.all(Object.keys(value.relationships).map((relName) => {
            return value.relationships[relName].reduce((thenable: Promise<void | ModelData>, delta) => {
              return thenable.then(() => {
                if (delta.op === 'add') {
                  return this.terminal.writeRelationshipItem(updated, relName, delta.data);
                } else if (delta.op === 'remove') {
                  return this.terminal.deleteRelationshipItem(updated, relName, delta.data);
                } else if (delta.op === 'modify') {
                  return this.terminal.writeRelationshipItem(updated, relName, delta.data);
                } else {
                  throw new Error(`Unknown relationship delta ${JSON.stringify(delta)}`);
                }
              });
            }, Promise.resolve());
          })).then(() => updated);
        } else {
          return updated;
        }
      });
    } else {
      return Promise.reject(new Error('Plump has no terminal store'));
    }
  }

  delete(item: ModelReference): Promise<void> {
    if (this.terminal) {
      return this.terminal.delete(item).then(() => {
        return Promise.all(this.caches.map((store) => {
          return store.wipe(item);
        }));
      }).then(() => { /* noop */ } );
    } else {
      return Promise.reject(new Error('Plump has no terminal store'));
    }
  }

  add(item: ModelReference, relName: string, child: RelationshipItem) {
    if (this.terminal) {
      return this.terminal.writeRelationshipItem(item, relName, child);
    } else {
      return Promise.reject(new Error('Plump has no terminal store'));
    }
  }

  // restRequest(opts) {
  //   if (this.terminal && this.terminal.rest) {
  //     return this.terminal.rest(opts);
  //   } else {
  //     return Promise.reject(new Error('No Rest terminal store'));
  //   }
  // }

  modifyRelationship(item: ModelReference, relName: string, child: RelationshipItem) {
    return this.add(item, relName, child);
  }

  query(q: any): Promise<ModelReference[]> {
    return this.terminal.query(q);
  }

  deleteRelationshipItem(item: ModelReference, relName: string, child: RelationshipItem) {
    if (this.terminal) {
      return this.terminal.deleteRelationshipItem(item, relName, child);
    } else {
      return Promise.reject(new Error('Plump has no terminal store'));
    }
  }

  invalidate(item: ModelReference, field?: string | string[]): void {
    const fields = Array.isArray(field) ? field : [field];
    this.terminal.fireWriteUpdate({ type: item.type, id: item.id , invalidate: fields });
  }

  static wire(me: CacheStore, they: TerminalStore, shutdownSignal: Observable<string>) {
    if (me.terminal) {
      throw new Error('Cannot wire a terminal store into another store');
    } else {
      // TODO: figure out where the type data comes from.
      they.read$.takeUntil(shutdownSignal).subscribe((v) => {
        me.cache(v);
      });
      they.write$.takeUntil(shutdownSignal).subscribe((v) => {
        v.invalidate.forEach((invalid) => {
          me.wipe(v, invalid);
        });
      });
    }
  }


}
