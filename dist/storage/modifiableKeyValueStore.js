"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var mergeOptions = require("merge-options");
var storage_1 = require("./storage");
var ModifiableKeyValueStore = (function (_super) {
    __extends(ModifiableKeyValueStore, _super);
    function ModifiableKeyValueStore() {
        var _this = _super !== null && _super.apply(this, arguments) || this;
        _this.maxKeys = {};
        return _this;
    }
    ModifiableKeyValueStore.prototype.allocateId = function (type) {
        this.maxKeys[type] = this.maxKeys[type] + 1;
        return Promise.resolve(this.maxKeys[type]);
    };
    ModifiableKeyValueStore.prototype.writeAttributes = function (inputValue) {
        var _this = this;
        var value = this.validateInput(inputValue);
        delete value.relationships;
        return Promise.resolve()
            .then(function () {
            var idAttribute = _this.getSchema(inputValue.type).idAttribute;
            if ((value.id === undefined) || (value.id === null)) {
                if (!_this.terminal) {
                    throw new Error('Cannot create new content in a non-terminal store');
                }
                return _this.allocateId(value.type)
                    .then(function (n) {
                    return mergeOptions({}, value, { id: n, relationships: {}, attributes: (_a = {}, _a[idAttribute] = n, _a) });
                    var _a;
                });
            }
            else {
                return value;
            }
        })
            .then(function (toSave) {
            return _this._upsert(toSave)
                .then(function () {
                _this.fireWriteUpdate(Object.assign({}, toSave, { invalidate: ['attributes'] }));
                return toSave;
            });
        });
    };
    ModifiableKeyValueStore.prototype.readAttributes = function (value) {
        return this._get(value)
            .then(function (d) {
            if (d && d.attributes) {
                return d;
            }
            else {
                return null;
            }
        });
    };
    ModifiableKeyValueStore.prototype.cache = function (value) {
        var _this = this;
        if ((value.id === undefined) || (value.id === null)) {
            return Promise.reject('Cannot cache data without an id - write it to a terminal first');
        }
        else {
            return this._get(value)
                .then(function (current) {
                var newVal = mergeOptions(current || {}, value);
                return _this._upsert(newVal);
            });
        }
    };
    ModifiableKeyValueStore.prototype.cacheAttributes = function (value) {
        var _this = this;
        if ((value.id === undefined) || (value.id === null)) {
            return Promise.reject('Cannot cache data without an id - write it to a terminal first');
        }
        else {
            return this._get(value)
                .then(function (current) {
                return _this._upsert({
                    type: value.type,
                    id: value.id,
                    attributes: value.attributes,
                    relationships: current.relationships || {},
                });
            });
        }
    };
    ModifiableKeyValueStore.prototype.cacheRelationship = function (value) {
        var _this = this;
        if ((value.id === undefined) || (value.id === null)) {
            return Promise.reject('Cannot cache data without an id - write it to a terminal first');
        }
        else {
            return this._get(value)
                .then(function (current) {
                return _this._upsert({
                    type: value.type,
                    id: value.id,
                    attributes: current.attributes || {},
                    relationships: value.relationships,
                });
            });
        }
    };
    ModifiableKeyValueStore.prototype.readRelationship = function (value, relName) {
        var _this = this;
        return this._get(value)
            .then(function (v) {
            var retVal = Object.assign({}, v);
            if (!v) {
                if (_this.terminal) {
                    return { type: value.type, id: value.id, relationships: (_a = {}, _a[relName] = [], _a) };
                }
                else {
                    return null;
                }
            }
            else if (!v.relationships && _this.terminal) {
                retVal.relationships = (_b = {}, _b[relName] = [], _b);
            }
            else if (!retVal.relationships[relName] && _this.terminal) {
                retVal.relationships[relName] = [];
            }
            return retVal;
            var _a, _b;
        });
    };
    ModifiableKeyValueStore.prototype.delete = function (value) {
        var _this = this;
        return this._del(value, ['attributes', 'relationships'])
            .then(function () {
            if (_this.terminal) {
                _this.fireWriteUpdate({ id: value.id, type: value.type, invalidate: ['attributes', 'relationships'] });
            }
        });
    };
    ModifiableKeyValueStore.prototype.wipe = function (value, field) {
        return this._del(value, [field]);
    };
    ModifiableKeyValueStore.prototype.writeRelationshipItem = function (value, relName, child) {
        var _this = this;
        var schema = this.getSchema(value.type);
        var relSchema = schema.relationships[relName].type;
        var otherRelName = relSchema.sides[relName].otherName;
        var newChild = { type: child.type, id: child.id };
        var newParent = { type: value.type, id: value.id };
        if (relSchema.extras && child.meta) {
            newParent.meta = {};
            newChild.meta = {};
            for (var extra in child.meta) {
                if (extra in relSchema.extras) {
                    newChild.meta[extra] = child.meta[extra];
                    newParent.meta[extra] = child.meta[extra];
                }
            }
        }
        return Promise.all([
            this._updateArray(value, relName, newChild),
            this._updateArray(child, otherRelName, newParent)
        ])
            .then(function () {
            _this.fireWriteUpdate(Object.assign(value, { invalidate: ["relationships." + relName] }));
            _this.fireWriteUpdate(Object.assign(child, { invalidate: ["relationships." + otherRelName] }));
        })
            .then(function () { return value; });
    };
    ModifiableKeyValueStore.prototype.deleteRelationshipItem = function (value, relName, child) {
        var _this = this;
        var schema = this.getSchema(value.type);
        var relSchema = schema.relationships[relName].type;
        var otherRelName = relSchema.sides[relName].otherName;
        var newChild = { type: child.type, id: child.id };
        var newParent = { type: value.type, id: value.id };
        if (relSchema.extras && child.meta) {
            newParent.meta = {};
            newChild.meta = {};
            for (var extra in child.meta) {
                if (extra in relSchema.extras) {
                    newChild.meta[extra] = child.meta[extra];
                    newParent.meta[extra] = child.meta[extra];
                }
            }
        }
        return Promise.all([
            this._removeFromArray(value, relName, newChild),
            this._removeFromArray(child, otherRelName, newParent)
        ])
            .then(function () {
            _this.fireWriteUpdate(Object.assign(value, { invalidate: ["relationships." + relName] }));
            _this.fireWriteUpdate(Object.assign(child, { invalidate: ["relationships." + otherRelName] }));
        })
            .then(function () { return value; });
    };
    ModifiableKeyValueStore.prototype.query = function (t) {
        return this._keys(t)
            .then(function (keys) {
            return keys.map(function (k) {
                return {
                    type: t,
                    id: parseInt(k.split(':')[1], 10),
                };
            }).filter(function (v) { return !isNaN(v.id); });
        });
    };
    ModifiableKeyValueStore.prototype.addSchema = function (t) {
        var _this = this;
        return _super.prototype.addSchema.call(this, t)
            .then(function () {
            _this.maxKeys[t.type] = 0;
        });
    };
    ModifiableKeyValueStore.prototype.keyString = function (value) {
        return value.type + ":" + value.id;
    };
    return ModifiableKeyValueStore;
}(storage_1.Storage));
exports.ModifiableKeyValueStore = ModifiableKeyValueStore;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zdG9yYWdlL21vZGlmaWFibGVLZXlWYWx1ZVN0b3JlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQUFBLDRDQUE4QztBQUU5QyxxQ0FBb0M7QUFjcEM7SUFBc0QsMkNBQU87SUFBN0Q7UUFBQSxxRUFrTkM7UUFqTlcsYUFBTyxHQUErQixFQUFFLENBQUM7O0lBaU5yRCxDQUFDO0lBeE1DLDRDQUFVLEdBQVYsVUFBVyxJQUFZO1FBQ3JCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDNUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRCxpREFBZSxHQUFmLFVBQWdCLFVBQStCO1FBQS9DLGlCQTBCQztRQXpCQyxJQUFNLEtBQUssR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1FBQzdDLE9BQU8sS0FBSyxDQUFDLGFBQWEsQ0FBQztRQUUzQixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sRUFBRTthQUN2QixJQUFJLENBQUM7WUFDSixJQUFNLFdBQVcsR0FBRyxLQUFJLENBQUMsU0FBUyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUM7WUFDaEUsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBQ3BELEVBQUUsQ0FBQyxDQUFDLENBQUMsS0FBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDLENBQUM7b0JBQ25CLE1BQU0sSUFBSSxLQUFLLENBQUMsbURBQW1ELENBQUMsQ0FBQztnQkFDdkUsQ0FBQztnQkFDRCxNQUFNLENBQUMsS0FBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO3FCQUNqQyxJQUFJLENBQUMsVUFBQyxDQUFDO29CQUNOLE1BQU0sQ0FBQyxZQUFZLENBQUMsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQUUsYUFBYSxFQUFFLEVBQUUsRUFBRSxVQUFVLFlBQUksR0FBQyxXQUFXLElBQUcsQ0FBQyxLQUFFLEVBQUUsQ0FBYyxDQUFDOztnQkFDOUcsQ0FBQyxDQUFDLENBQUM7WUFDTCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxDQUFDLEtBQWtCLENBQUM7WUFDNUIsQ0FBQztRQUNILENBQUMsQ0FBQzthQUNELElBQUksQ0FBQyxVQUFDLE1BQWlCO1lBQ3RCLE1BQU0sQ0FBQyxLQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztpQkFDMUIsSUFBSSxDQUFDO2dCQUNKLEtBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsTUFBTSxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7Z0JBQ2hGLE1BQU0sQ0FBQyxNQUFNLENBQUM7WUFDaEIsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxnREFBYyxHQUFkLFVBQWUsS0FBcUI7UUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO2FBQ3RCLElBQUksQ0FBQyxVQUFBLENBQUM7WUFHTCxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUM7Z0JBQ3RCLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDWCxDQUFDO1lBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQ04sTUFBTSxDQUFDLElBQUksQ0FBQztZQUNkLENBQUM7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCx1Q0FBSyxHQUFMLFVBQU0sS0FBZ0I7UUFBdEIsaUJBVUM7UUFUQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwRCxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxnRUFBZ0UsQ0FBQyxDQUFDO1FBQzFGLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztpQkFDdEIsSUFBSSxDQUFDLFVBQUMsT0FBTztnQkFDWixJQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsT0FBTyxJQUFJLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztnQkFDbEQsTUFBTSxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7WUFDOUIsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztJQUVELGlEQUFlLEdBQWYsVUFBZ0IsS0FBZ0I7UUFBaEMsaUJBY0M7UUFiQyxFQUFFLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxFQUFFLEtBQUssU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNwRCxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxnRUFBZ0UsQ0FBQyxDQUFDO1FBQzFGLENBQUM7UUFBQyxJQUFJLENBQUMsQ0FBQztZQUNOLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQztpQkFDdEIsSUFBSSxDQUFDLFVBQUMsT0FBTztnQkFDWixNQUFNLENBQUMsS0FBSSxDQUFDLE9BQU8sQ0FBQztvQkFDbEIsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJO29CQUNoQixFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUU7b0JBQ1osVUFBVSxFQUFFLEtBQUssQ0FBQyxVQUFVO29CQUM1QixhQUFhLEVBQUUsT0FBTyxDQUFDLGFBQWEsSUFBSSxFQUFFO2lCQUMzQyxDQUFDLENBQUM7WUFDTCxDQUFDLENBQUMsQ0FBQztRQUNMLENBQUM7SUFDSCxDQUFDO0lBRUQsbURBQWlCLEdBQWpCLFVBQWtCLEtBQWdCO1FBQWxDLGlCQWNDO1FBYkMsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsRUFBRSxLQUFLLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEVBQUUsS0FBSyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDcEQsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsZ0VBQWdFLENBQUMsQ0FBQztRQUMxRixDQUFDO1FBQUMsSUFBSSxDQUFDLENBQUM7WUFDTixNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUM7aUJBQ3RCLElBQUksQ0FBQyxVQUFDLE9BQU87Z0JBQ1osTUFBTSxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUM7b0JBQ2xCLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSTtvQkFDaEIsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFO29CQUNaLFVBQVUsRUFBRSxPQUFPLENBQUMsVUFBVSxJQUFJLEVBQUU7b0JBQ3BDLGFBQWEsRUFBRSxLQUFLLENBQUMsYUFBYTtpQkFDbkMsQ0FBQyxDQUFDO1lBQ0wsQ0FBQyxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztJQUVELGtEQUFnQixHQUFoQixVQUFpQixLQUFxQixFQUFFLE9BQWU7UUFBdkQsaUJBaUJDO1FBaEJDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQzthQUN0QixJQUFJLENBQUMsVUFBQyxDQUFDO1lBQ04sSUFBTSxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDcEMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO2dCQUNQLEVBQUUsQ0FBQyxDQUFDLEtBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO29CQUNsQixNQUFNLENBQUMsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxhQUFhLFlBQUksR0FBQyxPQUFPLElBQUcsRUFBRSxLQUFFLEVBQUUsQ0FBQztnQkFDOUUsQ0FBQztnQkFBQyxJQUFJLENBQUMsQ0FBQztvQkFDTixNQUFNLENBQUMsSUFBSSxDQUFDO2dCQUNkLENBQUM7WUFDSCxDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsSUFBSSxLQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDN0MsTUFBTSxDQUFDLGFBQWEsYUFBSyxHQUFDLE9BQU8sSUFBRyxFQUFFLEtBQUUsQ0FBQztZQUMzQyxDQUFDO1lBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsSUFBSSxLQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDM0QsTUFBTSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDckMsQ0FBQztZQUNELE1BQU0sQ0FBQyxNQUFNLENBQUM7O1FBQ2hCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELHdDQUFNLEdBQU4sVUFBTyxLQUFxQjtRQUE1QixpQkFPQztRQU5DLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxDQUFDLFlBQVksRUFBRSxlQUFlLENBQUMsQ0FBQzthQUN2RCxJQUFJLENBQUM7WUFDSixFQUFFLENBQUMsQ0FBQyxLQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztnQkFDbEIsS0FBSSxDQUFDLGVBQWUsQ0FBQyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLFVBQVUsRUFBRSxDQUFDLFlBQVksRUFBRSxlQUFlLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDeEcsQ0FBQztRQUNILENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELHNDQUFJLEdBQUosVUFBSyxLQUFxQixFQUFFLEtBQWE7UUFDdkMsTUFBTSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUNuQyxDQUFDO0lBRUQsdURBQXFCLEdBQXJCLFVBQXNCLEtBQXFCLEVBQUUsT0FBZSxFQUFFLEtBQXVCO1FBQXJGLGlCQTBCQztRQXpCQyxJQUFNLE1BQU0sR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUMxQyxJQUFNLFNBQVMsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQUksQ0FBQztRQUNyRCxJQUFNLFlBQVksR0FBRyxTQUFTLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQyxDQUFDLFNBQVMsQ0FBQztRQUV4RCxJQUFNLFFBQVEsR0FBcUIsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3RFLElBQU0sU0FBUyxHQUFxQixFQUFFLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDdkUsRUFBRSxDQUFDLENBQUMsU0FBUyxDQUFDLE1BQU0sSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztZQUNuQyxTQUFTLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNwQixRQUFRLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztZQUNuQixHQUFHLENBQUMsQ0FBQyxJQUFNLEtBQUssSUFBSSxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQztnQkFDL0IsRUFBRSxDQUFDLENBQUMsS0FBSyxJQUFJLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO29CQUM5QixRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3pDLFNBQVMsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDNUMsQ0FBQztZQUNILENBQUM7UUFDSCxDQUFDO1FBQ0QsTUFBTSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDakIsSUFBSSxDQUFDLFlBQVksQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQztZQUMzQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxZQUFZLEVBQUUsU0FBUyxDQUFDO1NBQ2xELENBQUM7YUFDRCxJQUFJLENBQUM7WUFDSixLQUFJLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSyxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsbUJBQWlCLE9BQVMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQ3pGLEtBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxtQkFBaUIsWUFBYyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDaEcsQ0FBQyxDQUFDO2FBQ0QsSUFBSSxDQUFDLGNBQU0sT0FBQSxLQUFLLEVBQUwsQ0FBSyxDQUFDLENBQUM7SUFDckIsQ0FBQztJQUVELHdEQUFzQixHQUF0QixVQUF1QixLQUFxQixFQUFFLE9BQWUsRUFBRSxLQUF1QjtRQUF0RixpQkEwQkM7UUF6QkMsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLENBQUM7UUFDMUMsSUFBTSxTQUFTLEdBQUcsTUFBTSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFJLENBQUM7UUFDckQsSUFBTSxZQUFZLEdBQUcsU0FBUyxDQUFDLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxTQUFTLENBQUM7UUFFeEQsSUFBTSxRQUFRLEdBQXFCLEVBQUUsSUFBSSxFQUFFLEtBQUssQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLEtBQUssQ0FBQyxFQUFFLEVBQUUsQ0FBQztRQUN0RSxJQUFNLFNBQVMsR0FBcUIsRUFBRSxJQUFJLEVBQUUsS0FBSyxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLEVBQUUsRUFBRSxDQUFDO1FBQ3ZFLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxNQUFNLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7WUFDbkMsU0FBUyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7WUFDcEIsUUFBUSxDQUFDLElBQUksR0FBRyxFQUFFLENBQUM7WUFDbkIsR0FBRyxDQUFDLENBQUMsSUFBTSxLQUFLLElBQUksS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQy9CLEVBQUUsQ0FBQyxDQUFDLEtBQUssSUFBSSxTQUFTLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztvQkFDOUIsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO29CQUN6QyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQzVDLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztRQUNELE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDO1lBQ2pCLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFLLEVBQUUsT0FBTyxFQUFFLFFBQVEsQ0FBQztZQUMvQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsS0FBSyxFQUFFLFlBQVksRUFBRSxTQUFTLENBQUM7U0FDdEQsQ0FBQzthQUNELElBQUksQ0FBQztZQUNKLEtBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFLLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxtQkFBaUIsT0FBUyxDQUFDLEVBQUUsQ0FBQyxDQUFDLENBQUM7WUFDekYsS0FBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEtBQUssRUFBRSxFQUFFLFVBQVUsRUFBRSxDQUFDLG1CQUFpQixZQUFjLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUNoRyxDQUFDLENBQUM7YUFDRCxJQUFJLENBQUMsY0FBTSxPQUFBLEtBQUssRUFBTCxDQUFLLENBQUMsQ0FBQztJQUNyQixDQUFDO0lBRUQsdUNBQUssR0FBTCxVQUFNLENBQVM7UUFDYixNQUFNLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7YUFDbkIsSUFBSSxDQUFDLFVBQUMsSUFBSTtZQUNULE1BQU0sQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFVBQUEsQ0FBQztnQkFDZixNQUFNLENBQUM7b0JBQ0wsSUFBSSxFQUFFLENBQUM7b0JBQ1AsRUFBRSxFQUFFLFFBQVEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLEVBQUUsQ0FBQztpQkFDbEMsQ0FBQztZQUNKLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBWixDQUFZLENBQUMsQ0FBQztRQUMvQixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCwyQ0FBUyxHQUFULFVBQVUsQ0FBc0M7UUFBaEQsaUJBS0M7UUFKQyxNQUFNLENBQUMsaUJBQU0sU0FBUyxZQUFDLENBQUMsQ0FBQzthQUN4QixJQUFJLENBQUM7WUFDSixLQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDM0IsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsMkNBQVMsR0FBVCxVQUFVLEtBQXFCO1FBQzdCLE1BQU0sQ0FBSSxLQUFLLENBQUMsSUFBSSxTQUFJLEtBQUssQ0FBQyxFQUFJLENBQUM7SUFDckMsQ0FBQztJQUNILDhCQUFDO0FBQUQsQ0FsTkEsQUFrTkMsQ0FsTnFELGlCQUFPLEdBa041RDtBQWxOcUIsMERBQXVCIiwiZmlsZSI6InN0b3JhZ2UvbW9kaWZpYWJsZUtleVZhbHVlU3RvcmUuanMiLCJzb3VyY2VzQ29udGVudCI6WyJpbXBvcnQgKiBhcyBtZXJnZU9wdGlvbnMgZnJvbSAnbWVyZ2Utb3B0aW9ucyc7XG5cbmltcG9ydCB7IFN0b3JhZ2UgfSBmcm9tICcuL3N0b3JhZ2UnO1xuaW1wb3J0IHtcbiAgSW5kZWZpbml0ZU1vZGVsRGF0YSxcbiAgTW9kZWxEYXRhLFxuICBNb2RlbFJlZmVyZW5jZSxcbiAgTW9kZWxTY2hlbWEsXG4gIFJlbGF0aW9uc2hpcEl0ZW0sXG4gIFRlcm1pbmFsU3RvcmUsXG4gIENhY2hlU3RvcmUsXG4gIEFsbG9jYXRpbmdTdG9yZVxufSBmcm9tICcuLi9kYXRhVHlwZXMnO1xuXG4vLyBkZWNsYXJlIGZ1bmN0aW9uIHBhcnNlSW50KG46IHN0cmluZyB8IG51bWJlciwgcmFkaXg6IG51bWJlcik6IG51bWJlcjtcblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIE1vZGlmaWFibGVLZXlWYWx1ZVN0b3JlIGV4dGVuZHMgU3RvcmFnZSBpbXBsZW1lbnRzIFRlcm1pbmFsU3RvcmUsIENhY2hlU3RvcmUsIEFsbG9jYXRpbmdTdG9yZSB7XG4gIHByb3RlY3RlZCBtYXhLZXlzOiB7IFt0eXBlOiBzdHJpbmddOiBudW1iZXIgfSA9IHt9O1xuXG4gIGFic3RyYWN0IF9rZXlzKHR5cGU6IHN0cmluZyk6IFByb21pc2U8c3RyaW5nW10+O1xuICBhYnN0cmFjdCBfZ2V0KHJlZjogTW9kZWxSZWZlcmVuY2UpOiBQcm9taXNlPE1vZGVsRGF0YSB8IG51bGw+O1xuICBhYnN0cmFjdCBfdXBzZXJ0KHY6IE1vZGVsRGF0YSk6IFByb21pc2U8TW9kZWxEYXRhPjtcbiAgYWJzdHJhY3QgX3VwZGF0ZUFycmF5KHJlZjogTW9kZWxSZWZlcmVuY2UsIHJlbE5hbWU6IHN0cmluZywgaXRlbTogUmVsYXRpb25zaGlwSXRlbSk6IFByb21pc2U8TW9kZWxSZWZlcmVuY2U+O1xuICBhYnN0cmFjdCBfcmVtb3ZlRnJvbUFycmF5KHJlZjogTW9kZWxSZWZlcmVuY2UsIHJlbE5hbWU6IHN0cmluZywgaXRlbTogUmVsYXRpb25zaGlwSXRlbSk6IFByb21pc2U8TW9kZWxSZWZlcmVuY2U+O1xuICBhYnN0cmFjdCBfZGVsKHJlZjogTW9kZWxSZWZlcmVuY2UsIGZpZWxkczogc3RyaW5nW10pOiBQcm9taXNlPE1vZGVsRGF0YT47XG5cbiAgYWxsb2NhdGVJZCh0eXBlOiBzdHJpbmcpIHtcbiAgICB0aGlzLm1heEtleXNbdHlwZV0gPSB0aGlzLm1heEtleXNbdHlwZV0gKyAxO1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUodGhpcy5tYXhLZXlzW3R5cGVdKTtcbiAgfVxuXG4gIHdyaXRlQXR0cmlidXRlcyhpbnB1dFZhbHVlOiBJbmRlZmluaXRlTW9kZWxEYXRhKSB7XG4gICAgY29uc3QgdmFsdWUgPSB0aGlzLnZhbGlkYXRlSW5wdXQoaW5wdXRWYWx1ZSk7XG4gICAgZGVsZXRlIHZhbHVlLnJlbGF0aW9uc2hpcHM7XG4gICAgLy8gdHJpbSBvdXQgcmVsYXRpb25zaGlwcyBmb3IgYSBkaXJlY3Qgd3JpdGUuXG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSgpXG4gICAgLnRoZW4oKCkgPT4ge1xuICAgICAgY29uc3QgaWRBdHRyaWJ1dGUgPSB0aGlzLmdldFNjaGVtYShpbnB1dFZhbHVlLnR5cGUpLmlkQXR0cmlidXRlO1xuICAgICAgaWYgKCh2YWx1ZS5pZCA9PT0gdW5kZWZpbmVkKSB8fCAodmFsdWUuaWQgPT09IG51bGwpKSB7XG4gICAgICAgIGlmICghdGhpcy50ZXJtaW5hbCkge1xuICAgICAgICAgIHRocm93IG5ldyBFcnJvcignQ2Fubm90IGNyZWF0ZSBuZXcgY29udGVudCBpbiBhIG5vbi10ZXJtaW5hbCBzdG9yZScpO1xuICAgICAgICB9XG4gICAgICAgIHJldHVybiB0aGlzLmFsbG9jYXRlSWQodmFsdWUudHlwZSlcbiAgICAgICAgLnRoZW4oKG4pID0+IHtcbiAgICAgICAgICByZXR1cm4gbWVyZ2VPcHRpb25zKHt9LCB2YWx1ZSwgeyBpZDogbiwgcmVsYXRpb25zaGlwczoge30sIGF0dHJpYnV0ZXM6IHsgW2lkQXR0cmlidXRlXTogbiB9IH0pIGFzIE1vZGVsRGF0YTsgLy8gaWYgbmV3LlxuICAgICAgICB9KTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiB2YWx1ZSBhcyBNb2RlbERhdGE7XG4gICAgICB9XG4gICAgfSlcbiAgICAudGhlbigodG9TYXZlOiBNb2RlbERhdGEpID0+IHtcbiAgICAgIHJldHVybiB0aGlzLl91cHNlcnQodG9TYXZlKVxuICAgICAgLnRoZW4oKCkgPT4ge1xuICAgICAgICB0aGlzLmZpcmVXcml0ZVVwZGF0ZShPYmplY3QuYXNzaWduKHt9LCB0b1NhdmUsIHsgaW52YWxpZGF0ZTogWydhdHRyaWJ1dGVzJ10gfSkpO1xuICAgICAgICByZXR1cm4gdG9TYXZlO1xuICAgICAgfSk7XG4gICAgfSk7XG4gIH1cblxuICByZWFkQXR0cmlidXRlcyh2YWx1ZTogTW9kZWxSZWZlcmVuY2UpOiBQcm9taXNlPE1vZGVsRGF0YT4ge1xuICAgIHJldHVybiB0aGlzLl9nZXQodmFsdWUpXG4gICAgLnRoZW4oZCA9PiB7XG4gICAgICAvLyBUT0RPOiBmaWd1cmUgb3V0IHdoYXQgaGFwcGVucyB3aGVuIHRoZXJlJ3MgYVxuICAgICAgLy8gZmllbGQgd2l0aCBubyByZWFsIGF0dHJpYnV0ZXNcbiAgICAgIGlmIChkICYmIGQuYXR0cmlidXRlcykge1xuICAgICAgICByZXR1cm4gZDtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIHJldHVybiBudWxsO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgY2FjaGUodmFsdWU6IE1vZGVsRGF0YSkge1xuICAgIGlmICgodmFsdWUuaWQgPT09IHVuZGVmaW5lZCkgfHwgKHZhbHVlLmlkID09PSBudWxsKSkge1xuICAgICAgcmV0dXJuIFByb21pc2UucmVqZWN0KCdDYW5ub3QgY2FjaGUgZGF0YSB3aXRob3V0IGFuIGlkIC0gd3JpdGUgaXQgdG8gYSB0ZXJtaW5hbCBmaXJzdCcpO1xuICAgIH0gZWxzZSB7XG4gICAgICByZXR1cm4gdGhpcy5fZ2V0KHZhbHVlKVxuICAgICAgLnRoZW4oKGN1cnJlbnQpID0+IHtcbiAgICAgICAgY29uc3QgbmV3VmFsID0gbWVyZ2VPcHRpb25zKGN1cnJlbnQgfHwge30sIHZhbHVlKTtcbiAgICAgICAgcmV0dXJuIHRoaXMuX3Vwc2VydChuZXdWYWwpO1xuICAgICAgfSk7XG4gICAgfVxuICB9XG5cbiAgY2FjaGVBdHRyaWJ1dGVzKHZhbHVlOiBNb2RlbERhdGEpIHtcbiAgICBpZiAoKHZhbHVlLmlkID09PSB1bmRlZmluZWQpIHx8ICh2YWx1ZS5pZCA9PT0gbnVsbCkpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgnQ2Fubm90IGNhY2hlIGRhdGEgd2l0aG91dCBhbiBpZCAtIHdyaXRlIGl0IHRvIGEgdGVybWluYWwgZmlyc3QnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX2dldCh2YWx1ZSlcbiAgICAgIC50aGVuKChjdXJyZW50KSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl91cHNlcnQoe1xuICAgICAgICAgIHR5cGU6IHZhbHVlLnR5cGUsXG4gICAgICAgICAgaWQ6IHZhbHVlLmlkLFxuICAgICAgICAgIGF0dHJpYnV0ZXM6IHZhbHVlLmF0dHJpYnV0ZXMsXG4gICAgICAgICAgcmVsYXRpb25zaGlwczogY3VycmVudC5yZWxhdGlvbnNoaXBzIHx8IHt9LFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIGNhY2hlUmVsYXRpb25zaGlwKHZhbHVlOiBNb2RlbERhdGEpIHtcbiAgICBpZiAoKHZhbHVlLmlkID09PSB1bmRlZmluZWQpIHx8ICh2YWx1ZS5pZCA9PT0gbnVsbCkpIHtcbiAgICAgIHJldHVybiBQcm9taXNlLnJlamVjdCgnQ2Fubm90IGNhY2hlIGRhdGEgd2l0aG91dCBhbiBpZCAtIHdyaXRlIGl0IHRvIGEgdGVybWluYWwgZmlyc3QnKTtcbiAgICB9IGVsc2Uge1xuICAgICAgcmV0dXJuIHRoaXMuX2dldCh2YWx1ZSlcbiAgICAgIC50aGVuKChjdXJyZW50KSA9PiB7XG4gICAgICAgIHJldHVybiB0aGlzLl91cHNlcnQoe1xuICAgICAgICAgIHR5cGU6IHZhbHVlLnR5cGUsXG4gICAgICAgICAgaWQ6IHZhbHVlLmlkLFxuICAgICAgICAgIGF0dHJpYnV0ZXM6IGN1cnJlbnQuYXR0cmlidXRlcyB8fCB7fSxcbiAgICAgICAgICByZWxhdGlvbnNoaXBzOiB2YWx1ZS5yZWxhdGlvbnNoaXBzLFxuICAgICAgICB9KTtcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxuXG4gIHJlYWRSZWxhdGlvbnNoaXAodmFsdWU6IE1vZGVsUmVmZXJlbmNlLCByZWxOYW1lOiBzdHJpbmcpOiBQcm9taXNlPE1vZGVsRGF0YT4ge1xuICAgIHJldHVybiB0aGlzLl9nZXQodmFsdWUpXG4gICAgLnRoZW4oKHYpID0+IHtcbiAgICAgIGNvbnN0IHJldFZhbCA9IE9iamVjdC5hc3NpZ24oe30sIHYpO1xuICAgICAgaWYgKCF2KSB7XG4gICAgICAgIGlmICh0aGlzLnRlcm1pbmFsKSB7XG4gICAgICAgICAgcmV0dXJuIHsgdHlwZTogdmFsdWUudHlwZSwgaWQ6IHZhbHVlLmlkLCByZWxhdGlvbnNoaXBzOiB7IFtyZWxOYW1lXTogW10gfSB9O1xuICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgIHJldHVybiBudWxsO1xuICAgICAgICB9XG4gICAgICB9IGVsc2UgaWYgKCF2LnJlbGF0aW9uc2hpcHMgJiYgdGhpcy50ZXJtaW5hbCkge1xuICAgICAgICByZXRWYWwucmVsYXRpb25zaGlwcyA9IHsgW3JlbE5hbWVdOiBbXSB9O1xuICAgICAgfSBlbHNlIGlmICghcmV0VmFsLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0gJiYgdGhpcy50ZXJtaW5hbCkge1xuICAgICAgICByZXRWYWwucmVsYXRpb25zaGlwc1tyZWxOYW1lXSA9IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIHJldFZhbDtcbiAgICB9KTtcbiAgfVxuXG4gIGRlbGV0ZSh2YWx1ZTogTW9kZWxSZWZlcmVuY2UpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVsKHZhbHVlLCBbJ2F0dHJpYnV0ZXMnLCAncmVsYXRpb25zaGlwcyddKVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIGlmICh0aGlzLnRlcm1pbmFsKSB7XG4gICAgICAgIHRoaXMuZmlyZVdyaXRlVXBkYXRlKHsgaWQ6IHZhbHVlLmlkLCB0eXBlOiB2YWx1ZS50eXBlLCBpbnZhbGlkYXRlOiBbJ2F0dHJpYnV0ZXMnLCAncmVsYXRpb25zaGlwcyddIH0pO1xuICAgICAgfVxuICAgIH0pO1xuICB9XG5cbiAgd2lwZSh2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIGZpZWxkOiBzdHJpbmcpIHtcbiAgICByZXR1cm4gdGhpcy5fZGVsKHZhbHVlLCBbZmllbGRdKTtcbiAgfVxuXG4gIHdyaXRlUmVsYXRpb25zaGlwSXRlbSh2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIHJlbE5hbWU6IHN0cmluZywgY2hpbGQ6IFJlbGF0aW9uc2hpcEl0ZW0pIHtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYSh2YWx1ZS50eXBlKTtcbiAgICBjb25zdCByZWxTY2hlbWEgPSBzY2hlbWEucmVsYXRpb25zaGlwc1tyZWxOYW1lXS50eXBlO1xuICAgIGNvbnN0IG90aGVyUmVsTmFtZSA9IHJlbFNjaGVtYS5zaWRlc1tyZWxOYW1lXS5vdGhlck5hbWU7XG5cbiAgICBjb25zdCBuZXdDaGlsZDogUmVsYXRpb25zaGlwSXRlbSA9IHsgdHlwZTogY2hpbGQudHlwZSwgaWQ6IGNoaWxkLmlkIH07XG4gICAgY29uc3QgbmV3UGFyZW50OiBSZWxhdGlvbnNoaXBJdGVtID0geyB0eXBlOiB2YWx1ZS50eXBlLCBpZDogdmFsdWUuaWQgfTtcbiAgICBpZiAocmVsU2NoZW1hLmV4dHJhcyAmJiBjaGlsZC5tZXRhKSB7XG4gICAgICBuZXdQYXJlbnQubWV0YSA9IHt9O1xuICAgICAgbmV3Q2hpbGQubWV0YSA9IHt9O1xuICAgICAgZm9yIChjb25zdCBleHRyYSBpbiBjaGlsZC5tZXRhKSB7XG4gICAgICAgIGlmIChleHRyYSBpbiByZWxTY2hlbWEuZXh0cmFzKSB7XG4gICAgICAgICAgbmV3Q2hpbGQubWV0YVtleHRyYV0gPSBjaGlsZC5tZXRhW2V4dHJhXTtcbiAgICAgICAgICBuZXdQYXJlbnQubWV0YVtleHRyYV0gPSBjaGlsZC5tZXRhW2V4dHJhXTtcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH1cbiAgICByZXR1cm4gUHJvbWlzZS5hbGwoW1xuICAgICAgdGhpcy5fdXBkYXRlQXJyYXkodmFsdWUsIHJlbE5hbWUsIG5ld0NoaWxkKSxcbiAgICAgIHRoaXMuX3VwZGF0ZUFycmF5KGNoaWxkLCBvdGhlclJlbE5hbWUsIG5ld1BhcmVudClcbiAgICBdKVxuICAgIC50aGVuKCgpID0+IHtcbiAgICAgIHRoaXMuZmlyZVdyaXRlVXBkYXRlKE9iamVjdC5hc3NpZ24odmFsdWUsIHsgaW52YWxpZGF0ZTogW2ByZWxhdGlvbnNoaXBzLiR7cmVsTmFtZX1gXSB9KSk7XG4gICAgICB0aGlzLmZpcmVXcml0ZVVwZGF0ZShPYmplY3QuYXNzaWduKGNoaWxkLCB7IGludmFsaWRhdGU6IFtgcmVsYXRpb25zaGlwcy4ke290aGVyUmVsTmFtZX1gXSB9KSk7XG4gICAgfSlcbiAgICAudGhlbigoKSA9PiB2YWx1ZSk7XG4gIH1cblxuICBkZWxldGVSZWxhdGlvbnNoaXBJdGVtKHZhbHVlOiBNb2RlbFJlZmVyZW5jZSwgcmVsTmFtZTogc3RyaW5nLCBjaGlsZDogUmVsYXRpb25zaGlwSXRlbSkge1xuICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZ2V0U2NoZW1hKHZhbHVlLnR5cGUpO1xuICAgIGNvbnN0IHJlbFNjaGVtYSA9IHNjaGVtYS5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdLnR5cGU7XG4gICAgY29uc3Qgb3RoZXJSZWxOYW1lID0gcmVsU2NoZW1hLnNpZGVzW3JlbE5hbWVdLm90aGVyTmFtZTtcblxuICAgIGNvbnN0IG5ld0NoaWxkOiBSZWxhdGlvbnNoaXBJdGVtID0geyB0eXBlOiBjaGlsZC50eXBlLCBpZDogY2hpbGQuaWQgfTtcbiAgICBjb25zdCBuZXdQYXJlbnQ6IFJlbGF0aW9uc2hpcEl0ZW0gPSB7IHR5cGU6IHZhbHVlLnR5cGUsIGlkOiB2YWx1ZS5pZCB9O1xuICAgIGlmIChyZWxTY2hlbWEuZXh0cmFzICYmIGNoaWxkLm1ldGEpIHtcbiAgICAgIG5ld1BhcmVudC5tZXRhID0ge307XG4gICAgICBuZXdDaGlsZC5tZXRhID0ge307XG4gICAgICBmb3IgKGNvbnN0IGV4dHJhIGluIGNoaWxkLm1ldGEpIHtcbiAgICAgICAgaWYgKGV4dHJhIGluIHJlbFNjaGVtYS5leHRyYXMpIHtcbiAgICAgICAgICBuZXdDaGlsZC5tZXRhW2V4dHJhXSA9IGNoaWxkLm1ldGFbZXh0cmFdO1xuICAgICAgICAgIG5ld1BhcmVudC5tZXRhW2V4dHJhXSA9IGNoaWxkLm1ldGFbZXh0cmFdO1xuICAgICAgICB9XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBQcm9taXNlLmFsbChbXG4gICAgICB0aGlzLl9yZW1vdmVGcm9tQXJyYXkodmFsdWUsIHJlbE5hbWUsIG5ld0NoaWxkKSxcbiAgICAgIHRoaXMuX3JlbW92ZUZyb21BcnJheShjaGlsZCwgb3RoZXJSZWxOYW1lLCBuZXdQYXJlbnQpXG4gICAgXSlcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLmZpcmVXcml0ZVVwZGF0ZShPYmplY3QuYXNzaWduKHZhbHVlLCB7IGludmFsaWRhdGU6IFtgcmVsYXRpb25zaGlwcy4ke3JlbE5hbWV9YF0gfSkpO1xuICAgICAgdGhpcy5maXJlV3JpdGVVcGRhdGUoT2JqZWN0LmFzc2lnbihjaGlsZCwgeyBpbnZhbGlkYXRlOiBbYHJlbGF0aW9uc2hpcHMuJHtvdGhlclJlbE5hbWV9YF0gfSkpO1xuICAgIH0pXG4gICAgLnRoZW4oKCkgPT4gdmFsdWUpO1xuICB9XG5cbiAgcXVlcnkodDogc3RyaW5nKTogUHJvbWlzZTxNb2RlbFJlZmVyZW5jZVtdPiB7XG4gICAgcmV0dXJuIHRoaXMuX2tleXModClcbiAgICAudGhlbigoa2V5cykgPT4ge1xuICAgICAgcmV0dXJuIGtleXMubWFwKGsgPT4ge1xuICAgICAgICByZXR1cm4ge1xuICAgICAgICAgIHR5cGU6IHQsXG4gICAgICAgICAgaWQ6IHBhcnNlSW50KGsuc3BsaXQoJzonKVsxXSwgMTApLFxuICAgICAgICB9O1xuICAgICAgfSkuZmlsdGVyKHYgPT4gIWlzTmFOKHYuaWQpKTtcbiAgICB9KTtcbiAgfVxuXG4gIGFkZFNjaGVtYSh0OiB7dHlwZTogc3RyaW5nLCBzY2hlbWE6IE1vZGVsU2NoZW1hfSkge1xuICAgIHJldHVybiBzdXBlci5hZGRTY2hlbWEodClcbiAgICAudGhlbigoKSA9PiB7XG4gICAgICB0aGlzLm1heEtleXNbdC50eXBlXSA9IDA7XG4gICAgfSk7XG4gIH1cblxuICBrZXlTdHJpbmcodmFsdWU6IE1vZGVsUmVmZXJlbmNlKSB7XG4gICAgcmV0dXJuIGAke3ZhbHVlLnR5cGV9OiR7dmFsdWUuaWR9YDtcbiAgfVxufVxuIl19
