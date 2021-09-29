import Subscription from './subscription.js';
import {
  fillRefs,
  isSingleDocumentQuery,
  DEFAULT_OPTIONS,
} from './helpers.js';

const subscriptions = {};

const converter = {
  fromFirestore: function(doc, options) {
    return {
      id: doc.id,
      ...doc.data(options),
    };
  },
};

/**
 * firestoreAction - description
 *
 * @param  {type} action description
 * @return {type}        description
 */
function firestoreAction(action) {
  return (context, payload) => {
    const state = context.state;
    const getters = context.getters;

    /**
     * getFirestoreRef - get documents with filled references once
     *
     * @param  {String}  key      name of store property
     * @param  {Object}  query    firestore query
     * @param  {Object}  options  optional options
     * @return {Promise}          promise of request
     */
    function getFirestoreRef(key, query, options) {
      return get(key, query, state, { ...DEFAULT_OPTIONS, ...options });
    }

    /**
     * bindFirestoreRef - listen for realtime updates of documents and refs
     *
     * @param  {String}   key      name of store property
     * @param  {Object}   query    firestore query
     * @param  {Object}   options  optional options
     * @return {Function}          unsubscriber
     */
    function bindFirestoreRef(key, query, options) {
      const target = { object: state, property: key };
      subscriptions[key] = new Subscription(query, target);
      subscriptions[key].setOptions(options);
      subscriptions[key].bind();

      return (reset) => unbind(state, key, reset);
    }

    /**
     * unbindFirestoreRef - unbind firestore query
     *
     * @param  {String}           key    name of store property
     * @param  {Boolean|Function} reset  option of defailt value
     */
    function unbindFirestoreRef(key, reset) {
      unbind(state, key, reset);
    }

    return action({
      state,
      getters,
      payload,
      getFirestoreRef,
      bindFirestoreRef,
      unbindFirestoreRef,
    });
  };
}

/**
 * get - get data once
 *
 * @param  {String} key     name of storage state property
 * @param  {Object} query   firestore query
 * @param  {Object} state   storage state
 * @param  {Object} options fill options
 * @return {Object|Array}   result of query
 */
async function get(key, query, state, options) {
  if (isSingleDocumentQuery(query)) {
    const doc = await query.withConverter(converter).get();
    const data = doc.exists ? doc.data() : null;

    if (data) {
      fillRefs(data, () => state[key] = Object.assign({}, state[key]), options);
    }

    state[key] = data;
    return data;
  } else {
    const querySnapshot = await query.withConverter(converter).get();
    const docs = querySnapshot.docs.map((doc) => doc.data());
    fillRefs(docs, () => state[key] = [...state[key]], options);
    state[key] = [...docs];
    return docs;
  }
}

/**
 * unbind - stop listening to the document and its subs
 *
 * @param  {Object}           state          store state
 * @param  {String}           key           name of store property
 * @param  {Boolean|Function} reset          option of defailt value
 */
function unbind(state, key, reset) {
  subscriptions[key]?.unbind();
  delete subscriptions[key];

  if (reset !== false) {
    state[key] = typeof reset === 'function' ? reset() : null;
  }
}

class ReactiveVariable {
  constructor(onChange) {
    this._onChange = onChange;
    // this._store = {state: this};
  }

  set value(value) {
    this._value = value;
    this._onChange?.();
  }

  get value() {
    return this._value;
  }

  get state() {
    return this;
  }
}

export {
  firestoreAction,
  ReactiveVariable,
};
