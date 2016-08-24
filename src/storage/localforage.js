import * as axios from 'axios';

export class LocalForageStorage {

  constructor(opts = {}) {
  }

  create(t, v) {
    return this._axios.post(`/${t}`, v);
  }

  read(t, id) {
    return this._axios.get(`/${t}/${id}`)
    .then((response) => {
      return response.data;
    });
  }

  update(t, id, v) {
    return this._axios.put(`/${t}/${id}`, v)
    .then((response) => {
      return response.data;
    });
  }

  delete(t, id) {
    return this._axios.delete(`/${t}/${id}`)
    .then((response) => {
      return response.data;
    });
  }

  query(q) {
    return this._axios.get(`/${q.type}`, {params: q.query})
    .then((response) => {
      return response.data;
    });
  }
}
