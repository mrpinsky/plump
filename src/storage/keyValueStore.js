import * as Bluebird from 'bluebird';
import mergeOptions from 'merge-options';

import { Storage } from './storage';

function saneNumber(i) {
  return ((typeof i === 'number') && (!isNaN(i)) && (i !== Infinity) & (i !== -Infinity));
}

function maybePush(array, val, keystring, store, idx) {
  return Bluebird.resolve()
  .then(() => {
    if (idx < 0) {
      array.push(val);
      return store._set(keystring, JSON.stringify(array));
    } else {
      return null;
    }
  });
}


function maybeUpdate(array, val, keystring, store, extras, idx) {
  return Bluebird.resolve()
  .then(() => {
    if (idx >= 0) {
      const modifiedRelationship = mergeOptions(
        {},
        array[idx],
        extras ? { meta: extras } : {}
      );
      array[idx] = modifiedRelationship; // eslint-disable-line no-param-reassign
      return store._set(keystring, JSON.stringify(array));
    } else {
      return null;
    }
  });
}

function maybeDelete(array, idx, keystring, store) {
  return Bluebird.resolve()
  .then(() => {
    if (idx >= 0) {
      array.splice(idx, 1);
      return store._set(keystring, JSON.stringify(array));
    } else {
      return null;
    }
  });
}

function applyDelta(base, delta) {
  if (delta.op === 'add' || delta.op === 'modify') {
    const retVal = mergeOptions({}, base, delta.data);
    return retVal;
  } else if (delta.op === 'remove') {
    return undefined;
  } else {
    return base;
  }
}

function resolveRelationship(deltas, maybeBase) {
  const base = maybeBase || [];
  // Index current relationships by ID for efficient modification
  const updates = base.map(rel => {
    return { [rel.id]: rel };
  }).reduce((acc, curr) => mergeOptions(acc, curr), {});

  // Apply any deltas in dirty cache on top of updates
  deltas.forEach(delta => {
    const childId = delta.data.id;
    updates[childId] = applyDelta(updates[childId], delta);
  });

  // Collapse updates back into list, omitting undefineds
  return Object.keys(updates)
    .map(id => updates[id])
    .filter(rel => rel !== undefined)
    .reduce((acc, curr) => acc.concat(curr), []);
}

// TODO
function resolveRelationships(schema, deltas, base = {}) {
  const updates = {};
  for (const relName in deltas) {
    if (relName in schema.relationships) {
      updates[relName] = resolveRelationship(deltas[relName], base[relName]);
    }
  }
  return mergeOptions({}, base, updates);
}


export class KeyValueStore extends Storage {
  $$maxKey(t) {
    return this._keys(t)
    .then((keyArray) => {
      if (keyArray.length === 0) {
        return 0;
      } else {
        return keyArray.map((k) => k.split(':')[2])
        .map((k) => parseInt(k, 10))
        .filter((i) => saneNumber(i))
        .reduce((max, current) => (current > max) ? current : max, 0);
      }
    });
  }

  write(t, v) {
    const id = v.id || v[t.$schema.$id];
    if ((id === undefined) || (id === null)) {
      return this.createNew(t, v);
    } else {
      return this.overwrite(t, id, v);
    }
  }

  createNew(t, v) {
    const toSave = mergeOptions({}, v);
    if (this.terminal) {
      return this.$$maxKey(t.$name)
      .then((n) => {
        const id = n + 1;
        toSave.id = id;
        return Bluebird.all([
          this.writeAttributes(t, id, toSave.attributes),
          this.writeRelationships(t, id, toSave.relationships),
        ]).then(() => {
          return this.notifyUpdate(t, toSave[t.$id], {
            [t.$schema.$id]: id,
            attributes: toSave.attributes,
            relationships: resolveRelationships(t.$schema, toSave.relationships),
          });
        })
        .then(() => toSave);
      });
    } else {
      throw new Error('Cannot create new content in a non-terminal store');
    }
  }

  overwrite(t, id, v) {
    return Bluebird.all([
      this._get(this.keyString(t.$name, id)),
      this.readRelationships(t, id, Object.keys(v.relationships)),
    ]).then(([origAttributes, origRelationships]) => {
      const updatedAttributes = Object.assign({}, JSON.parse(origAttributes), v.attributes);
      const updatedRelationships = resolveRelationships(t.$schema, v.relationships, origRelationships);
      const updated = { id, attributes: updatedAttributes, relationships: updatedRelationships };
      return Bluebird.all([
        this.writeAttributes(t, id, updatedAttributes),
        this.writeRelationships(t, id, updatedRelationships),
      ])
      .then(() => {
        return this.notifyUpdate(t, id, updated);
      })
      .then(() => {
        return updated;
      });
    });
  }

  writeAttributes(t, id, attributes) {
    const $id = attributes.id ? 'id' : t.$schema.$id;
    const toWrite = mergeOptions({}, attributes, { [$id]: id });
    return this._set(this.keyString(t.$name, id), JSON.stringify(toWrite));
  }

  writeRelationships(t, id, relationships) {
    return Object.keys(relationships).map(relName => {
      return this._set(this.keyString(t.$name, id, relName), JSON.stringify(relationships[relName]));
    }).reduce((thenable, curr) => thenable.then(() => curr), Bluebird.resolve());
  }

  readAttributes(t, id) {
    return this._get(this.keyString(t.$name, id))
    .then(d => JSON.parse(d));
  }

  readRelationship(t, id, relationship) {
    return this._get(this.keyString(t.$name, id, relationship))
    .then((arrayString) => {
      return { [relationship]: JSON.parse(arrayString) || [] };
    });
  }

  delete(t, id) {
    return this._del(this.keyString(t.$name, id));
  }

  wipe(t, id, field) {
    if (field === 'attributes') {
      return this._del(this.keyString(t.$name, id));
    } else {
      return this._del(this.keyString(t.$name, id, field));
    }
  }

  add(type, id, relName, childId, extras = {}) {
    const relationshipBlock = type.$schema.relationships[relName].type;
    const thisType = type.$name;
    const otherType = relationshipBlock.$sides[relName].otherType;
    const otherName = relationshipBlock.$sides[relName].otherName;
    const thisKeyString = this.keyString(thisType, id, relName);
    const otherKeyString = this.keyString(otherType, childId, otherName);
    return Bluebird.all([
      this._get(thisKeyString),
      this._get(otherKeyString),
    ])
    .then(([thisArrayString, otherArrayString]) => {
      const thisArray = JSON.parse(thisArrayString) || [];
      const otherArray = JSON.parse(otherArrayString) || [];
      const newChild = { id: childId };
      const newParent = { id };
      if (relationshipBlock.$extras) {
        newChild.meta = newChild.meta || {};
        newParent.meta = newParent.meta || {};
        for (const extra in extras) {
          if (extra in relationshipBlock.$extras) {
            newChild.meta[extra] = extras[extra];
            newParent.meta[extra] = extras[extra];
          }
        }
      }
      const thisIdx = thisArray.findIndex(item => item.id === childId);
      const otherIdx = otherArray.findIndex(item => item.id === id);
      return Bluebird.all([
        maybePush(thisArray, newChild, thisKeyString, this, thisIdx),
        maybePush(otherArray, newParent, otherKeyString, this, otherIdx),
      ])
      .then(() => this.notifyUpdate(type, id, null, relName))
      .then(() => this.notifyUpdate(type, childId, null, otherName))
      .then(() => thisArray);
    });
  }

  modifyRelationship(type, id, relName, childId, extras) {
    const relationshipBlock = type.$schema.relationships[relName].type;
    const thisType = type.$name;
    const otherType = relationshipBlock.$sides[relName].otherType;
    const otherName = relationshipBlock.$sides[relName].otherName;
    const thisKeyString = this.keyString(thisType, id, relName);
    const otherKeyString = this.keyString(otherType, childId, otherName);
    return Bluebird.all([
      this._get(thisKeyString),
      this._get(otherKeyString),
    ])
    .then(([thisArrayString, otherArrayString]) => {
      const thisArray = JSON.parse(thisArrayString) || [];
      const otherArray = JSON.parse(otherArrayString) || [];
      const thisTarget = { id: childId };
      const otherTarget = { id };
      const thisIdx = thisArray.findIndex(item => item.id === childId);
      const otherIdx = otherArray.findIndex(item => item.id === id);
      return Bluebird.all([
        maybeUpdate(thisArray, thisTarget, thisKeyString, this, extras, thisIdx),
        maybeUpdate(otherArray, otherTarget, otherKeyString, this, extras, otherIdx),
      ]);
    })
    .then((res) => this.notifyUpdate(type, id, null, relName).then(() => res))
    .then((res) => this.notifyUpdate(type, childId, null, otherName).then(() => res));
  }

  remove(type, id, relName, childId) {
    const relationshipBlock = type.$schema.relationships[relName].type;
    const thisType = type.$name;
    const otherType = relationshipBlock.$sides[relName].otherType;
    const otherName = relationshipBlock.$sides[relName].otherName;
    const thisKeyString = this.keyString(thisType, id, relName);
    const otherKeyString = this.keyString(otherType, childId, otherName);
    return Bluebird.all([
      this._get(thisKeyString),
      this._get(otherKeyString),
    ])
    .then(([thisArrayString, otherArrayString]) => {
      const thisArray = JSON.parse(thisArrayString) || [];
      const otherArray = JSON.parse(otherArrayString) || [];
      const thisIdx = thisArray.findIndex(item => item.id === childId);
      const otherIdx = otherArray.findIndex(item => item.id === id);
      return Bluebird.all([
        maybeDelete(thisArray, thisIdx, thisKeyString, this),
        maybeDelete(otherArray, otherIdx, otherKeyString, this),
      ]);
    })
    .then((res) => this.notifyUpdate(type, id, null, relName).then(() => res))
    .then((res) => this.notifyUpdate(type, childId, null, otherName).then(() => res));
  }

  keyString(typeName, id, relationship) {
    return `${typeName}:${relationship ? `rel.${relationship}` : 'attributes'}:${id}`;
  }
}
