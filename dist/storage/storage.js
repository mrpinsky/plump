"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var mergeOptions = require("merge-options");
var rxjs_1 = require("rxjs");
var Storage = (function () {
    function Storage(opts) {
        if (opts === void 0) { opts = {}; }
        this.types = {};
        this.readSubject = new rxjs_1.Subject();
        this.writeSubject = new rxjs_1.Subject();
        this.terminal = opts.terminal || false;
        this.read$ = this.readSubject.asObservable();
        this.write$ = this.writeSubject.asObservable();
    }
    Storage.prototype.readRelationships = function (item, relationships) {
        var _this = this;
        return Promise.all(relationships.map(function (r) { return _this.readRelationship(item, r); }))
            .then(function (rA) {
            return rA.reduce(function (a, r) { return mergeOptions(a, r || {}); }, { type: item.type, id: item.id, attributes: {}, relationships: {} });
        });
    };
    Storage.prototype.read = function (item, opts) {
        var _this = this;
        if (opts === void 0) { opts = ['attributes']; }
        var schema = this.getSchema(item.type);
        var keys = (opts && !Array.isArray(opts) ? [opts] : opts);
        return this.readAttributes(item)
            .then(function (attributes) {
            if (!attributes) {
                return null;
            }
            else {
                if (attributes.id && attributes.attributes && !attributes.attributes[schema.idAttribute]) {
                    attributes.attributes[schema.idAttribute] = attributes.id;
                }
                if (attributes.attributes) {
                    for (var attrName in schema.attributes) {
                        if (!attributes.attributes[attrName] && (schema.attributes[attrName].default !== undefined)) {
                            if (Array.isArray(schema.attributes[attrName].default)) {
                                attributes.attributes[attrName] = schema.attributes[attrName].default.concat();
                            }
                            else if (typeof schema.attributes[attrName].default === 'object') {
                                attributes.attributes[attrName] = Object.assign({}, schema.attributes[attrName].default);
                            }
                            else {
                                attributes.attributes[attrName] = schema.attributes[attrName].default;
                            }
                        }
                    }
                }
                var relsWanted = (keys.indexOf('relationships') >= 0)
                    ? Object.keys(schema.relationships)
                    : keys.map(function (k) { return k.split('.'); })
                        .filter(function (ka) { return ka[0] === 'relationships'; })
                        .map(function (ka) { return ka[1]; });
                var relsToFetch = relsWanted.filter(function (relName) { return !attributes.relationships[relName]; });
                if (relsToFetch.length > 0) {
                    return _this.readRelationships(item, relsToFetch)
                        .then(function (rels) {
                        return mergeOptions(attributes, rels);
                    });
                }
                else {
                    return attributes;
                }
            }
        })
            .then(function (result) {
            if (result) {
                _this.fireReadUpdate(result);
            }
            return result;
        });
    };
    Storage.prototype.bulkRead = function (item) {
        return this.read(item).then(function (data) {
            if (data.included === undefined) {
                data.included = [];
            }
            return data;
        });
    };
    Storage.prototype.hot = function (item) {
        return false;
    };
    Storage.prototype.validateInput = function (value) {
        var schema = this.getSchema(value.type);
        var retVal = { type: value.type, id: value.id, attributes: {}, relationships: {} };
        var typeAttrs = Object.keys(schema.attributes || {});
        var valAttrs = Object.keys(value.attributes || {});
        var typeRels = Object.keys(schema.relationships || {});
        var valRels = Object.keys(value.relationships || {});
        var idAttribute = schema.idAttribute;
        var invalidAttrs = valAttrs.filter(function (item) { return typeAttrs.indexOf(item) < 0; });
        var invalidRels = valRels.filter(function (item) { return typeRels.indexOf(item) < 0; });
        if (invalidAttrs.length > 0) {
            throw new Error("Invalid attributes on value object: " + JSON.stringify(invalidAttrs));
        }
        if (invalidRels.length > 0) {
            throw new Error("Invalid relationships on value object: " + JSON.stringify(invalidRels));
        }
        if (value.attributes[idAttribute] && !retVal.id) {
            retVal.id = value.attributes[idAttribute];
        }
        for (var relName in schema.relationships) {
            if (value.relationships && value.relationships[relName] && !Array.isArray(value.relationships[relName])) {
                throw new Error("relation " + relName + " is not an array");
            }
        }
        return mergeOptions({}, value, retVal);
    };
    Storage.prototype.getSchema = function (t) {
        if (typeof t === 'string') {
            return this.types[t];
        }
        else if (t['schema']) {
            return t.schema;
        }
        else {
            return t;
        }
    };
    Storage.prototype.addSchema = function (t) {
        this.types[t.type] = t.schema;
        return Promise.resolve();
    };
    Storage.prototype.addSchemas = function (a) {
        var _this = this;
        return Promise.all(a.map(function (t) { return _this.addSchema(t); })).then(function () { });
    };
    Storage.prototype.fireWriteUpdate = function (val) {
        this.writeSubject.next(val);
        return Promise.resolve(val);
    };
    Storage.prototype.fireReadUpdate = function (val) {
        this.readSubject.next(val);
        return Promise.resolve(val);
    };
    return Storage;
}());
exports.Storage = Storage;

//# sourceMappingURL=data:application/json;charset=utf8;base64,eyJ2ZXJzaW9uIjozLCJzb3VyY2VzIjpbIi4uL3NyYy9zdG9yYWdlL3N0b3JhZ2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQSw0Q0FBOEM7QUFFOUMsNkJBQTJDO0FBdUIzQztJQVVFLGlCQUFZLElBQXlCO1FBQXpCLHFCQUFBLEVBQUEsU0FBeUI7UUFMM0IsVUFBSyxHQUFtQyxFQUFFLENBQUM7UUFDN0MsZ0JBQVcsR0FBRyxJQUFJLGNBQU8sRUFBRSxDQUFDO1FBQzVCLGlCQUFZLEdBQUcsSUFBSSxjQUFPLEVBQUUsQ0FBQztRQVluQyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxRQUFRLElBQUksS0FBSyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUM3QyxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQyxZQUFZLENBQUMsWUFBWSxFQUFFLENBQUM7SUFDakQsQ0FBQztJQXFCRCxtQ0FBaUIsR0FBakIsVUFBa0IsSUFBb0IsRUFBRSxhQUF1QjtRQUEvRCxpQkFRQztRQVBDLE1BQU0sQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxLQUFJLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxFQUE5QixDQUE4QixDQUFDLENBQUM7YUFDekUsSUFBSSxDQUFDLFVBQUEsRUFBRTtZQUNOLE9BQUEsRUFBRSxDQUFDLE1BQU0sQ0FDUCxVQUFDLENBQUMsRUFBRSxDQUFDLElBQUssT0FBQSxZQUFZLENBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSSxFQUFFLENBQUMsRUFBeEIsQ0FBd0IsRUFDbEMsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLEVBQUUsRUFBRSxVQUFVLEVBQUUsRUFBRSxFQUFFLGFBQWEsRUFBRSxFQUFFLEVBQUUsQ0FDcEU7UUFIRCxDQUdDLENB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QUMsQ0FBQztJQUM5QixDQUFDO0lBQ0gsY0FBQztBQUFELENBaE5BLEFBZ05DLElBQUE7QUFoTnFCLDBCQUFPIiwiZmlsZSI6InN0b3JhZ2Uvc3RvcmFnZS5qcyIsInNvdXJjZXNDb250ZW50IjpbIi8qIGVzbGludCBuby11bnVzZWQtdmFyczogMCAqL1xuXG5pbXBvcnQgKiBhcyBtZXJnZU9wdGlvbnMgZnJvbSAnbWVyZ2Utb3B0aW9ucyc7XG4vLyBpbXBvcnQgeyB2YWxpZGF0ZUlucHV0IH0gZnJvbSAnLi4vdXRpbCc7XG5pbXBvcnQgeyBTdWJqZWN0LCBPYnNlcnZhYmxlIH0gZnJvbSAncnhqcyc7XG5pbXBvcnQge1xuICBJbmRlZmluaXRlTW9kZWxEYXRhLFxuICBNb2RlbERhdGEsXG4gIE1vZGVsRGVsdGEsXG4gIE1vZGVsU2NoZW1hLFxuICBNb2RlbFJlZmVyZW5jZSxcbiAgQmFzZVN0b3JlLFxuICBTdG9yYWdlT3B0aW9ucyxcbiAgLy8gUmVsYXRpb25zaGlwSXRlbSxcbn0gZnJvbSAnLi4vZGF0YVR5cGVzJztcblxuLy8gdHlwZTogYW4gb2JqZWN0IHRoYXQgZGVmaW5lcyB0aGUgdHlwZS4gdHlwaWNhbGx5IHRoaXMgd2lsbCBiZVxuLy8gcGFydCBvZiB0aGUgTW9kZWwgY2xhc3MgaGllcmFyY2h5LCBidXQgU3RvcmFnZSBvYmplY3RzIGNhbGwgbm8gbWV0aG9kc1xuLy8gb24gdGhlIHR5cGUgb2JqZWN0LiBXZSBvbmx5IGFyZSBpbnRlcmVzdGVkIGluIFR5cGUuJG5hbWUsIFR5cGUuJGlkIGFuZCBUeXBlLiRzY2hlbWEuXG4vLyBOb3RlIHRoYXQgVHlwZS4kaWQgaXMgdGhlICpuYW1lIG9mIHRoZSBpZCBmaWVsZCogb24gaW5zdGFuY2VzXG4vLyAgICBhbmQgTk9UIHRoZSBhY3R1YWwgaWQgZmllbGQgKGUuZy4sIGluIG1vc3QgY2FzZXMsIFR5cGUuJGlkID09PSAnaWQnKS5cbi8vIGlkOiB1bmlxdWUgaWQuIE9mdGVuIGFuIGludGVnZXIsIGJ1dCBub3QgbmVjZXNzYXJ5IChjb3VsZCBiZSBhbiBvaWQpXG5cblxuLy8gaGFzTWFueSByZWxhdGlvbnNoaXBzIGFyZSB0cmVhdGVkIGxpa2UgaWQgYXJyYXlzLiBTbywgYWRkIC8gcmVtb3ZlIC8gaGFzXG4vLyBqdXN0IHN0b3JlcyBhbmQgcmVtb3ZlcyBpbnRlZ2Vycy5cblxuZXhwb3J0IGFic3RyYWN0IGNsYXNzIFN0b3JhZ2UgaW1wbGVtZW50cyBCYXNlU3RvcmUge1xuXG4gIHRlcm1pbmFsOiBib29sZWFuO1xuICByZWFkJDogT2JzZXJ2YWJsZTxNb2RlbERhdGE+O1xuICB3cml0ZSQ6IE9ic2VydmFibGU8TW9kZWxEZWx0YT47XG4gIHByb3RlY3RlZCB0eXBlczogeyBbdHlwZTogc3RyaW5nXTogTW9kZWxTY2hlbWF9ID0ge307XG4gIHByaXZhdGUgcmVhZFN1YmplY3QgPSBuZXcgU3ViamVjdCgpO1xuICBwcml2YXRlIHdyaXRlU3ViamVjdCA9IG5ldyBTdWJqZWN0KCk7XG4gIC8vIHByb3RlY3RlZCB0eXBlczogTW9kZWxbXTsgVE9ETzogZmlndXJlIHRoaXMgb3V0XG5cbiAgY29uc3RydWN0b3Iob3B0czogU3RvcmFnZU9wdGlvbnMgPSB7fSkge1xuICAgIC8vIGEgXCJ0ZXJtaW5hbFwiIHN0b3JhZ2UgZmFjaWxpdHkgaXMgdGhlIGVuZCBvZiB0aGUgc3RvcmFnZSBjaGFpbi5cbiAgICAvLyB1c3VhbGx5IHNxbCBvbiB0aGUgc2VydmVyIHNpZGUgYW5kIHJlc3Qgb24gdGhlIGNsaWVudCBzaWRlLCBpdCAqbXVzdCpcbiAgICAvLyByZWNlaXZlIHRoZSB3cml0ZXMsIGFuZCBpcyB0aGUgZmluYWwgYXV0aG9yaXRhdGl2ZSBhbnN3ZXIgb24gd2hldGhlclxuICAgIC8vIHNvbWV0aGluZyBpcyA0MDQuXG5cbiAgICAvLyB0ZXJtaW5hbCBmYWNpbGl0aWVzIGFyZSBhbHNvIHRoZSBvbmx5IG9uZXMgdGhhdCBjYW4gYXV0aG9yaXRhdGl2ZWx5IGFuc3dlclxuICAgIC8vIGF1dGhvcml6YXRpb24gcXVlc3Rpb25zLCBidXQgdGhlIGRlc2lnbiBtYXkgYWxsb3cgZm9yIGF1dGhvcml6YXRpb24gdG8gYmVcbiAgICAvLyBjYWNoZWQuXG4gICAgdGhpcy50ZXJtaW5hbCA9IG9wdHMudGVybWluYWwgfHwgZmFsc2U7XG4gICAgdGhpcy5yZWFkJCA9IHRoaXMucmVhZFN1YmplY3QuYXNPYnNlcnZhYmxlKCk7XG4gICAgdGhpcy53cml0ZSQgPSB0aGlzLndyaXRlU3ViamVjdC5hc09ic2VydmFibGUoKTtcbiAgfVxuXG4gIC8vIEFic3RyYWN0IC0gYWxsIHN0b3JlcyBtdXN0IHByb3ZpZGUgYmVsb3c6XG5cbiAgLy8gYWJzdHJhY3QgYWxsb2NhdGVJZCh0eXBlOiBzdHJpbmcpOiBQcm9taXNlPHN0cmluZyB8IG51bWJlcj47XG4gIC8vIGFic3RyYWN0IHdyaXRlQXR0cmlidXRlcyh2YWx1ZTogSW5kZWZpbml0ZU1vZGVsRGF0YSk6IFByb21pc2U8TW9kZWxEYXRhPjtcbiAgYWJzdHJhY3QgcmVhZEF0dHJpYnV0ZXModmFsdWU6IE1vZGVsUmVmZXJlbmNlKTogUHJvbWlzZTxNb2RlbERhdGE+O1xuICBhYnN0cmFjdCByZWFkUmVsYXRpb25zaGlwKHZhbHVlOiBNb2RlbFJlZmVyZW5jZSwgcmVsTmFtZTogc3RyaW5nKTogUHJvbWlzZTxNb2RlbERhdGE+O1xuICAvLyBhYnN0cmFjdCBkZWxldGUodmFsdWU6IE1vZGVsUmVmZXJlbmNlKTogUHJvbWlzZTx2b2lkPjtcbiAgLy8gYWJzdHJhY3Qgd3JpdGVSZWxhdGlvbnNoaXBJdGVtKCB2YWx1ZTogTW9kZWxSZWZlcmVuY2UsIHJlbE5hbWU6IHN0cmluZywgY2hpbGQ6IHtpZDogc3RyaW5nIHwgbnVtYmVyfSApOiBQcm9taXNlPE1vZGVsRGF0YT47XG4gIC8vIGFic3RyYWN0IGRlbGV0ZVJlbGF0aW9uc2hpcEl0ZW0oIHZhbHVlOiBNb2RlbFJlZmVyZW5jZSwgcmVsTmFtZTogc3RyaW5nLCBjaGlsZDoge2lkOiBzdHJpbmcgfCBudW1iZXJ9ICk6IFByb21pc2U8TW9kZWxEYXRhPjtcbiAgLy9cbiAgLy9cbiAgLy8gcXVlcnkocTogYW55KTogUHJvbWlzZTxNb2RlbFJlZmVyZW5jZVtdPiB7XG4gIC8vICAgLy8gcToge3R5cGU6IHN0cmluZywgcXVlcnk6IGFueX1cbiAgLy8gICAvLyBxLnF1ZXJ5IGlzIGltcGwgZGVmaW5lZCAtIGEgc3RyaW5nIGZvciBzcWwgKHJhdyBzcWwpXG4gIC8vICAgcmV0dXJuIFByb21pc2UucmVqZWN0KG5ldyBFcnJvcignUXVlcnkgbm90IGltcGxlbWVudGVkJykpO1xuICAvLyB9XG4gIC8vXG4gIC8vIGNvbnZlbmllbmNlIGZ1bmN0aW9uIHVzZWQgaW50ZXJuYWxseVxuICAvLyByZWFkIGEgYnVuY2ggb2YgcmVsYXRpb25zaGlwcyBhbmQgbWVyZ2UgdGhlbSB0b2dldGhlci5cbiAgcmVhZFJlbGF0aW9uc2hpcHMoaXRlbTogTW9kZWxSZWZlcmVuY2UsIHJlbGF0aW9uc2hpcHM6IHN0cmluZ1tdKSB7XG4gICAgcmV0dXJuIFByb21pc2UuYWxsKHJlbGF0aW9uc2hpcHMubWFwKHIgPT4gdGhpcy5yZWFkUmVsYXRpb25zaGlwKGl0ZW0sIHIpKSlcbiAgICAudGhlbihyQSA9PlxuICAgICAgckEucmVkdWNlKFxuICAgICAgICAoYSwgcikgPT4gbWVyZ2VPcHRpb25zKGEsIHIgfHwge30pLFxuICAgICAgICB7IHR5cGU6IGl0ZW0udHlwZSwgaWQ6IGl0ZW0uaWQsIGF0dHJpYnV0ZXM6IHt9LCByZWxhdGlvbnNoaXBzOiB7fSB9XG4gICAgICApXG4gICAgKTtcbiAgfVxuXG4gIHJlYWQoaXRlbTogTW9kZWxSZWZlcmVuY2UsIG9wdHM6IHN0cmluZyB8IHN0cmluZ1tdID0gWydhdHRyaWJ1dGVzJ10pIHtcbiAgICBjb25zdCBzY2hlbWEgPSB0aGlzLmdldFNjaGVtYShpdGVtLnR5cGUpO1xuICAgIGNvbnN0IGtleXMgPSAob3B0cyAmJiAhQXJyYXkuaXNBcnJheShvcHRzKSA/IFtvcHRzXSA6IG9wdHMpIGFzIHN0cmluZ1tdO1xuICAgIHJldHVybiB0aGlzLnJlYWRBdHRyaWJ1dGVzKGl0ZW0pXG4gICAgLnRoZW4oYXR0cmlidXRlcyA9PiB7XG4gICAgICBpZiAoIWF0dHJpYnV0ZXMpIHtcbiAgICAgICAgcmV0dXJuIG51bGw7XG4gICAgICB9IGVsc2Uge1xuICAgICAgICBpZiAoYXR0cmlidXRlcy5pZCAmJiBhdHRyaWJ1dGVzLmF0dHJpYnV0ZXMgJiYgIWF0dHJpYnV0ZXMuYXR0cmlidXRlc1tzY2hlbWEuaWRBdHRyaWJ1dGVdKSB7XG4gICAgICAgICAgYXR0cmlidXRlcy5hdHRyaWJ1dGVzW3NjaGVtYS5pZEF0dHJpYnV0ZV0gPSBhdHRyaWJ1dGVzLmlkOyAvLyBlc2xpbnQtZGlzYWJsZS1saW5lIG5vLXBhcmFtLXJlYXNzaWduXG4gICAgICAgIH1cblxuICAgICAgICAvLyBsb2FkIGluIGRlZmF1bHQgdmFsdWVzXG4gICAgICAgIGlmIChhdHRyaWJ1dGVzLmF0dHJpYnV0ZXMpIHtcbiAgICAgICAgICBmb3IgKGNvbnN0IGF0dHJOYW1lIGluIHNjaGVtYS5hdHRyaWJ1dGVzKSB7XG4gICAgICAgICAgICBpZiAoIWF0dHJpYnV0ZXMuYXR0cmlidXRlc1thdHRyTmFtZV0gJiYgKHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0ICE9PSB1bmRlZmluZWQpKSB7XG4gICAgICAgICAgICAgIGlmIChBcnJheS5pc0FycmF5KHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0KSkge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMuYXR0cmlidXRlc1thdHRyTmFtZV0gPSAoc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmRlZmF1bHQgYXMgYW55W10pLmNvbmNhdCgpO1xuICAgICAgICAgICAgICB9IGVsc2UgaWYgKHR5cGVvZiBzY2hlbWEuYXR0cmlidXRlc1thdHRyTmFtZV0uZGVmYXVsdCA9PT0gJ29iamVjdCcpIHtcbiAgICAgICAgICAgICAgICBhdHRyaWJ1dGVzLmF0dHJpYnV0ZXNbYXR0ck5hbWVdID0gT2JqZWN0LmFzc2lnbih7fSwgc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmRlZmF1bHQpO1xuICAgICAgICAgICAgICB9IGVsc2Uge1xuICAgICAgICAgICAgICAgIGF0dHJpYnV0ZXMuYXR0cmlidXRlc1thdHRyTmFtZV0gPSBzY2hlbWEuYXR0cmlidXRlc1thdHRyTmFtZV0uZGVmYXVsdDtcbiAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgfVxuICAgICAgICAgIH1cbiAgICAgICAgfVxuXG4gICAgICAgIGNvbnN0IHJlbHNXYW50ZWQgPSAoa2V5cy5pbmRleE9mKCdyZWxhdGlvbnNoaXBzJykgPj0gMClcbiAgICAgICAgICA/IE9iamVjdC5rZXlzKHNjaGVtYS5yZWxhdGlvbnNoaXBzKVxuICAgICAgICAgIDoga2V5cy5tYXAoayA9PiBrLnNwbGl0KCcuJykpXG4gICAgICAgICAgICAuZmlsdGVyKGthID0+IGthWzBdID09PSAncmVsYXRpb25zaGlwcycpXG4gICAgICAgICAgICAubWFwKGthID0+IGthWzFdKTtcbiAgICAgICAgY29uc3QgcmVsc1RvRmV0Y2ggPSByZWxzV2FudGVkLmZpbHRlcihyZWxOYW1lID0+ICFhdHRyaWJ1dGVzLnJlbGF0aW9uc2hpcHNbcmVsTmFtZV0pO1xuICAgICAgICAvLyByZWFkQXR0cmlidXRlcyBjYW4gcmV0dXJuIHJlbGF0aW9uc2hpcCBkYXRhLCBzbyBkb24ndCBmZXRjaCB0aG9zZVxuICAgICAgICBpZiAocmVsc1RvRmV0Y2gubGVuZ3RoID4gMCkge1xuICAgICAgICAgIHJldHVybiB0aGlzLnJlYWRSZWxhdGlvbnNoaXBzKGl0ZW0sIHJlbHNUb0ZldGNoKVxuICAgICAgICAgIC50aGVuKHJlbHMgPT4ge1xuICAgICAgICAgICAgcmV0dXJuIG1lcmdlT3B0aW9ucyhhdHRyaWJ1dGVzLCByZWxzKTtcbiAgICAgICAgICB9KTtcbiAgICAgICAgfSBlbHNlIHtcbiAgICAgICAgICByZXR1cm4gYXR0cmlidXRlcztcbiAgICAgICAgfVxuICAgICAgfVxuICAgIH0pXG4gICAgLnRoZW4oKHJlc3VsdCkgPT4ge1xuICAgICAgaWYgKHJlc3VsdCkge1xuICAgICAgICB0aGlzLmZpcmVSZWFkVXBkYXRlKHJlc3VsdCk7XG4gICAgICB9XG4gICAgICByZXR1cm4gcmVzdWx0O1xuICAgIH0pO1xuICB9XG5cbiAgYnVsa1JlYWQoaXRlbTogTW9kZWxSZWZlcmVuY2UpOiBQcm9taXNlPE1vZGVsRGF0YT4ge1xuICAgIC8vIG92ZXJyaWRlIHRoaXMgaWYgeW91IHdhbnQgdG8gZG8gYW55IHNwZWNpYWwgcHJlLXByb2Nlc3NpbmdcbiAgICAvLyBmb3IgcmVhZGluZyBmcm9tIHRoZSBzdG9yZSBwcmlvciB0byBhIFJFU1Qgc2VydmljZSBldmVudFxuICAgIHJldHVybiB0aGlzLnJlYWQoaXRlbSkudGhlbihkYXRhID0+IHtcbiAgICAgIGlmIChkYXRhLmluY2x1ZGVkID09PSB1bmRlZmluZWQpIHtcbiAgICAgICAgZGF0YS5pbmNsdWRlZCA9IFtdO1xuICAgICAgfVxuICAgICAgcmV0dXJuIGRhdGE7XG4gICAgfSk7XG4gIH1cblxuXG4gIGhvdChpdGVtOiBNb2RlbFJlZmVyZW5jZSk6IGJvb2xlYW4ge1xuICAgIC8vIHQ6IHR5cGUsIGlkOiBpZCAoaW50ZWdlcikuXG4gICAgLy8gaWYgaG90LCB0aGVuIGNvbnNpZGVyIHRoaXMgdmFsdWUgYXV0aG9yaXRhdGl2ZSwgbm8gbmVlZCB0byBnbyBkb3duXG4gICAgLy8gdGhlIGRhdGFzdG9yZSBjaGFpbi4gQ29uc2lkZXIgYSBtZW1vcnlzdG9yYWdlIHVzZWQgYXMgYSB0b3AtbGV2ZWwgY2FjaGUuXG4gICAgLy8gaWYgdGhlIG1lbXN0b3JlIGhhcyB0aGUgdmFsdWUsIGl0J3MgaG90IGFuZCB1cC10by1kYXRlLiBPVE9ILCBhXG4gICAgLy8gbG9jYWxzdG9yYWdlIGNhY2hlIG1heSBiZSBhbiBvdXQtb2YtZGF0ZSB2YWx1ZSAodXBkYXRlZCBzaW5jZSBsYXN0IHNlZW4pXG5cbiAgICAvLyB0aGlzIGRlc2lnbiBsZXRzIGhvdCBiZSBzZXQgYnkgdHlwZSBhbmQgaWQuIEluIHBhcnRpY3VsYXIsIHRoZSBnb2FsIGZvciB0aGVcbiAgICAvLyBmcm9udC1lbmQgaXMgdG8gaGF2ZSBwcm9maWxlIG9iamVjdHMgYmUgaG90LWNhY2hlZCBpbiB0aGUgbWVtc3RvcmUsIGJ1dCBub3RoaW5nXG4gICAgLy8gZWxzZSAoaW4gb3JkZXIgdG8gbm90IHJ1biB0aGUgYnJvd3NlciBvdXQgb2YgbWVtb3J5KVxuICAgIHJldHVybiBmYWxzZTtcbiAgfVxuXG4gIHZhbGlkYXRlSW5wdXQodmFsdWU6IE1vZGVsRGF0YSB8IEluZGVmaW5pdGVNb2RlbERhdGEpOiB0eXBlb2YgdmFsdWUge1xuICAgIGNvbnN0IHNjaGVtYSA9IHRoaXMuZ2V0U2NoZW1hKHZhbHVlLnR5cGUpO1xuICAgIGNvbnN0IHJldFZhbCA9IHsgdHlwZTogdmFsdWUudHlwZSwgaWQ6IHZhbHVlLmlkLCBhdHRyaWJ1dGVzOiB7fSwgcmVsYXRpb25zaGlwczoge30gfTtcbiAgICBjb25zdCB0eXBlQXR0cnMgPSBPYmplY3Qua2V5cyhzY2hlbWEuYXR0cmlidXRlcyB8fCB7fSk7XG4gICAgY29uc3QgdmFsQXR0cnMgPSBPYmplY3Qua2V5cyh2YWx1ZS5hdHRyaWJ1dGVzIHx8IHt9KTtcbiAgICBjb25zdCB0eXBlUmVscyA9IE9iamVjdC5rZXlzKHNjaGVtYS5yZWxhdGlvbnNoaXBzIHx8IHt9KTtcbiAgICBjb25zdCB2YWxSZWxzID0gT2JqZWN0LmtleXModmFsdWUucmVsYXRpb25zaGlwcyB8fCB7fSk7XG4gICAgY29uc3QgaWRBdHRyaWJ1dGUgPSBzY2hlbWEuaWRBdHRyaWJ1dGU7XG5cbiAgICBjb25zdCBpbnZhbGlkQXR0cnMgPSB2YWxBdHRycy5maWx0ZXIoaXRlbSA9PiB0eXBlQXR0cnMuaW5kZXhPZihpdGVtKSA8IDApO1xuICAgIGNvbnN0IGludmFsaWRSZWxzID0gdmFsUmVscy5maWx0ZXIoaXRlbSA9PiB0eXBlUmVscy5pbmRleE9mKGl0ZW0pIDwgMCk7XG5cbiAgICBpZiAoaW52YWxpZEF0dHJzLmxlbmd0aCA+IDApIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihgSW52YWxpZCBhdHRyaWJ1dGVzIG9uIHZhbHVlIG9iamVjdDogJHtKU09OLnN0cmluZ2lmeShpbnZhbGlkQXR0cnMpfWApO1xuICAgIH1cblxuICAgIGlmIChpbnZhbGlkUmVscy5sZW5ndGggPiAwKSB7XG4gICAgICB0aHJvdyBuZXcgRXJyb3IoYEludmFsaWQgcmVsYXRpb25zaGlwcyBvbiB2YWx1ZSBvYmplY3Q6ICR7SlNPTi5zdHJpbmdpZnkoaW52YWxpZFJlbHMpfWApO1xuICAgIH1cblxuICAgIC8vXG4gICAgLy8gZm9yIChjb25zdCBhdHRyTmFtZSBpbiBzY2hlbWEuYXR0cmlidXRlcykge1xuICAgIC8vICAgaWYgKCF2YWx1ZS5hdHRyaWJ1dGVzW2F0dHJOYW1lXSAmJiAoc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmRlZmF1bHQgIT09IHVuZGVmaW5lZCkpIHtcbiAgICAvLyAgICAgaWYgKEFycmF5LmlzQXJyYXkoc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmRlZmF1bHQpKSB7XG4gICAgLy8gICAgICAgcmV0VmFsLmF0dHJpYnV0ZXNbYXR0ck5hbWVdID0gKHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0IGFzIGFueVtdKS5jb25jYXQoKTtcbiAgICAvLyAgICAgfSBlbHNlIGlmICh0eXBlb2Ygc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmRlZmF1bHQgPT09ICdvYmplY3QnKSB7XG4gICAgLy8gICAgICAgcmV0VmFsLmF0dHJpYnV0ZXNbYXR0ck5hbWVdID0gT2JqZWN0LmFzc2lnbih7fSwgc2NoZW1hLmF0dHJpYnV0ZXNbYXR0ck5hbWVdLmRlZmF1bHQpO1xuICAgIC8vICAgICB9IGVsc2Uge1xuICAgIC8vICAgICAgIHJldFZhbC5hdHRyaWJ1dGVzW2F0dHJOYW1lXSA9IHNjaGVtYS5hdHRyaWJ1dGVzW2F0dHJOYW1lXS5kZWZhdWx0O1xuICAgIC8vICAgICB9XG4gICAgLy8gICB9XG4gICAgLy8gfVxuXG4gICAgaWYgKHZhbHVlLmF0dHJpYnV0ZXNbaWRBdHRyaWJ1dGVdICYmICFyZXRWYWwuaWQpIHtcbiAgICAgIHJldFZhbC5pZCA9IHZhbHVlLmF0dHJpYnV0ZXNbaWRBdHRyaWJ1dGVdO1xuICAgIH1cblxuICAgIGZvciAoY29uc3QgcmVsTmFtZSBpbiBzY2hlbWEucmVsYXRpb25zaGlwcykge1xuICAgICAgaWYgKHZhbHVlLnJlbGF0aW9uc2hpcHMgJiYgdmFsdWUucmVsYXRpb25zaGlwc1tyZWxOYW1lXSAmJiAhQXJyYXkuaXNBcnJheSh2YWx1ZS5yZWxhdGlvbnNoaXBzW3JlbE5hbWVdKSkge1xuICAgICAgICB0aHJvdyBuZXcgRXJyb3IoYHJlbGF0aW9uICR7cmVsTmFtZX0gaXMgbm90IGFuIGFycmF5YCk7XG4gICAgICB9XG4gICAgfVxuICAgIHJldHVybiBtZXJnZU9wdGlvbnMoe30sIHZhbHVlLCByZXRWYWwpO1xuICB9XG5cbiAgLy8gc3RvcmUgdHlwZSBpbmZvIGRhdGEgb24gdGhlIHN0b3JlIGl0c2VsZlxuXG4gIGdldFNjaGVtYSh0OiB7c2NoZW1hOiBNb2RlbFNjaGVtYX0gfCBNb2RlbFNjaGVtYSB8IHN0cmluZyk6IE1vZGVsU2NoZW1hIHtcbiAgICBpZiAodHlwZW9mIHQgPT09ICdzdHJpbmcnKSB7XG4gICAgICByZXR1cm4gdGhpcy50eXBlc1t0XTtcbiAgICB9IGVsc2UgaWYgKHRbJ3NjaGVtYSddKSB7XG4gICAgICByZXR1cm4gKHQgYXMge3NjaGVtYTogTW9kZWxTY2hlbWF9KS5zY2hlbWE7XG4gICAgfSBlbHNlIHtcbiAgICAgIHJldHVybiB0IGFzIE1vZGVsU2NoZW1hO1xuICAgIH1cbiAgfVxuXG4gIGFkZFNjaGVtYSh0OiB7dHlwZTogc3RyaW5nLCBzY2hlbWE6IE1vZGVsU2NoZW1hfSkge1xuICAgIHRoaXMudHlwZXNbdC50eXBlXSA9IHQuc2NoZW1hO1xuICAgIHJldHVybiBQcm9taXNlLnJlc29sdmUoKTtcbiAgfVxuXG4gIGFkZFNjaGVtYXMoYToge3R5cGU6IHN0cmluZywgc2NoZW1hOiBNb2RlbFNjaGVtYX1bXSk6IFByb21pc2U8dm9pZD4ge1xuICAgIHJldHVybiBQcm9taXNlLmFsbChcbiAgICAgIGEubWFwKHQgPT4gdGhpcy5hZGRTY2hlbWEodCkpXG4gICAgKS50aGVuKCgpID0+IHsvKiBub29wICovfSk7XG4gIH1cblxuXG4gIGZpcmVXcml0ZVVwZGF0ZSh2YWw6IE1vZGVsRGVsdGEpIHtcbiAgICB0aGlzLndyaXRlU3ViamVjdC5uZXh0KHZhbCk7XG4gICAgcmV0dXJuIFByb21pc2UucmVzb2x2ZSh2YWwpO1xuICB9XG5cbiAgZmlyZVJlYWRVcGRhdGUodmFsOiBNb2RlbERhdGEpIHtcbiAgICB0aGlzLnJlYWRTdWJqZWN0Lm5leHQodmFsKTtcbiAgICByZXR1cm4gUHJvbWlzZS5yZXNvbHZlKHZhbCk7XG4gIH1cbn1cbiJdfQ==
