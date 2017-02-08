/* eslint-env node, mocha*/

import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';
import Bluebird from 'bluebird';
import fs from 'fs';

import { Plump, Model, MemoryStorage, $all } from '../index';
import { TestType } from './testType';

const memstore2 = new MemoryStorage({ terminal: true });

const plump = new Plump({
  storage: [memstore2],
  types: [TestType],
});


chai.use(chaiAsPromised);
const expect = chai.expect;

describe('model', () => {
  describe('basic functionality', () => {
    it('should return promises to existing data', () => {
      const one = new TestType({ id: 1, name: 'potato' });
      return expect(one.$get()).to.eventually.have.property('name', 'potato');
    });

    it('should properly serialize its schema', () => {
      class MiniTest extends Model {}
      MiniTest.fromJSON(TestType.toJSON());
      return expect(MiniTest.toJSON()).to.deep.equal(TestType.toJSON());
    });

    it('should load data from datastores', () => {
      return memstore2.write(TestType, {
        id: 2,
        name: 'potato',
      }).then(() => {
        const two = plump.find('tests', 2);
        return expect(two.$get()).to.eventually.have.property('name', 'potato');
      });
    });

    it('should create an id when one is unset', () => {
      const noID = new TestType({ name: 'potato' }, plump);
      return expect(noID.$save().then((m) => m.$get())).to.eventually.contain.keys('name', 'id');
    });

    it('should allow data to be deleted', () => {
      const one = new TestType({ name: 'potato' }, plump);
      return one.$save()
      .then(() => expect(plump.find('tests', one.$id).$get()).to.eventually.have.property('name', 'potato'))
      .then(() => one.$delete())
      .then(() => expect(plump.find('tests', one.$id).$get()).to.eventually.be.null);
    });

    it('should allow fields to be loaded', () => {
      const one = new TestType({ name: 'p' }, plump);
      return one.$save()
      .then(() => expect(plump.find('tests', one.$id).$get()).to.eventually.have.property('name', 'p'))
      .then(() => {
        return expect(plump.find('tests', one.$id).$get($all))
        .to.eventually.deep.equal(TestType.assign({ name: 'p', id: one.$id }));
      });
    });

    it('should only load base fields on $get($self)', () => {
      const one = new TestType({ name: 'potato' }, plump);
      return one.$save()
      .then(() => {
        const baseFields = Object.keys(TestType.$fields).filter(field => TestType.$fields[field].type !== 'hasMany');
        // const hasManys = Object.keys(TestType.$fields).filter(field => TestType.$fields[field].type === 'hasMany');

        return expect(plump.find('tests', one.$id).$get()).to.eventually.have.all.keys(baseFields);
        // NOTE: .have.all requires list length equality
        // .and.not.keys(hasManys);
      });
    });

    it('should optimistically update on field updates', () => {
      const one = new TestType({ name: 'potato' }, plump);
      return one.$save()
      .then(() => one.$set({ name: 'rutabaga' }))
      .then(() => expect(one.$get()).to.eventually.have.property('name', 'rutabaga'));
    });

    it('should package all related documents for read', () => {
      const one = new TestType({
        id: 1,
        name: 'potato',
      }, plump);
      const two = new TestType({
        id: 2,
        name: 'frotato',
        extended: { cohort: 2013 },
      }, plump);
      const three = new TestType({
        id: 3,
        name: 'rutabaga',
      }, plump);

      return Bluebird.all([
        one.$save(),
        two.$save(),
        three.$save(),
      ]).then(() => {
        return Bluebird.all([
          one.$add('children', two.$id),
          two.$add('children', three.$id),
        ]);
      }).then(() => {
        return expect(one.$package()).to.eventually.deep.equal(
          JSON.parse(fs.readFileSync('src/test/testType.json'))
        );
      });
    });
  });

  describe('relationships', () => {
    it('should show empty hasMany lists as {key: []}', () => {
      const one = new TestType({ name: 'frotato' }, plump);
      return one.$save()
      .then(() => expect(one.$get('children')).to.eventually.deep.equal({ children: [] }));
    });

    it('should add hasMany elements', () => {
      const one = new TestType({ name: 'frotato' }, plump);
      return one.$save()
      .then(() => one.$add('children', 100))
      .then(() => {
        return expect(one.$get('children'))
        .to.eventually.deep.equal({ children: [{
          child_id: 100,
          parent_id: one.$id,
        }] });
      });
    });

    it('should add hasMany elements by child field', () => {
      const one = new TestType({ name: 'frotato' }, plump);
      return one.$save()
      .then(() => one.$add('children', { child_id: 100 }))
      .then(() => {
        return expect(one.$get('children'))
        .to.eventually.deep.equal({ children: [{
          child_id: 100,
          parent_id: one.$id,
        }] });
      });
    });

    it('should remove hasMany elements', () => {
      const one = new TestType({ name: 'frotato' }, plump);
      return one.$save()
      .then(() => one.$add('children', 100))
      .then(() => {
        return expect(one.$get('children'))
        .to.eventually.deep.equal({ children: [{
          child_id: 100,
          parent_id: one.$id,
        }] });
      })
      .then(() => one.$remove('children', 100))
      .then(() => expect(one.$get('children')).to.eventually.deep.equal({ children: [] }));
    });

    it('should include valence in hasMany operations', () => {
      const one = new TestType({ name: 'grotato' }, plump);
      return one.$save()
      .then(() => one.$add('valenceChildren', 100, { perm: 1 }))
      .then(() => one.$get('valenceChildren'))
      .then(() => {
        return expect(one.$get('valenceChildren'))
        .to.eventually.deep.equal({ valenceChildren: [{
          child_id: 100,
          parent_id: one.$id,
          perm: 1,
        }] });
      })
      .then(() => one.$modifyRelationship('valenceChildren', 100, { perm: 2 }))
      .then(() => {
        return expect(one.$get('valenceChildren'))
        .to.eventually.deep.equal({ valenceChildren: [{
          child_id: 100,
          parent_id: one.$id,
          perm: 2,
        }] });
      });
    });
  });

  describe('events', () => {
    it('should allow subscription to model data', (done) => {
      const one = new TestType({ name: 'potato' }, plump);
      let phase = 0;
      one.$save()
      .then(() => {
        const subscription = one.$subscribe((v) => {
          try {
            if (phase === 0) {
              if (v.name) {
                phase = 1;
              }
            }
            if (phase === 1) {
              expect(v).to.have.property('name', 'potato');
              if (v.id !== undefined) {
                phase = 2;
              }
            }
            if (phase === 2) {
              if (v.name !== 'potato') {
                expect(v).to.have.property('name', 'grotato');
                phase = 3;
              }
            }
            if (phase === 3) {
              if ((v.children) && (v.children.length > 0)) {
                expect(v.children).to.deep.equal([{
                  child_id: 100,
                  parent_id: one.$id,
                }]);
                subscription.unsubscribe();
                done();
              }
            }
          } catch (err) {
            done(err);
          }
        });
      })
      .then(() => one.$set({ name: 'grotato' }))
      .then(() => one.$add('children', { child_id: 100 }));
    });

    it('should allow subscription to model sideloads', (done) => {
      const one = new TestType({ name: 'potato' }, plump);
      let phase = 0;
      one.$save()
      .then(() => one.$add('children', { child_id: 100 }))
      .then(() => {
        const subscription = one.$subscribe([$all], (v) => {
          try {
            if (phase === 0) {
              if (v.name) {
                phase = 1;
              }
            }
            if (phase === 1) {
              expect(v).to.have.property('name', 'potato');
              expect(v.children).to.deep.equal([{
                child_id: 100,
                parent_id: one.$id,
              }]);
              phase = 2;
            }
            if (phase === 2) {
              if ((v.children) && (v.children.length > 1)) {
                expect(v.children).to.deep.equal([{
                  child_id: 100,
                  parent_id: one.$id,
                }, {
                  child_id: 101,
                  parent_id: one.$id,
                }]);
                subscription.unsubscribe();
                done();
              }
            }
          } catch (err) {
            done(err);
          }
        });
      })
      .then(() => one.$add('children', { child_id: 101 }));
    });

    it('should update on cacheable read events', (done) => {
      const DelayProxy = {
        get: (target, name) => {
          if (['read', 'write', 'add', 'remove'].indexOf(name) >= 0) {
            return (...args) => {
              return Bluebird.delay(200)
              .then(() => target[name](...args));
            };
          } else {
            return target[name];
          }
        },
      };
      const delayedMemstore = new Proxy(new MemoryStorage({ terminal: true }), DelayProxy);
      const coldMemstore = new MemoryStorage();
      const otherPlump = new Plump({
        storage: [coldMemstore, delayedMemstore],
        types: [TestType],
      });
      const one = new TestType({ name: 'slowtato' }, otherPlump);
      one.$save()
      .then(() => one.$get())
      .then((val) => {
        return coldMemstore.write(TestType, {
          name: 'potato',
          id: val.id,
        })
        .then(() => {
          let phase = 0;
          const two = otherPlump.find('tests', val.id);
          const subscription = two.$subscribe((v) => {
            try {
              if (phase === 0) {
                if (v.name) {
                  expect(v).to.have.property('name', 'potato');
                  phase = 1;
                }
              }
              if (phase === 1) {
                if (v.name !== 'potato') {
                  expect(v).to.have.property('name', 'slowtato');
                  subscription.unsubscribe();
                  done();
                }
              }
            } catch (err) {
              subscription.unsubscribe();
              done(err);
            }
          });
        });
      });
    });
  });
});
