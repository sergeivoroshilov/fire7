import {
  DEFAULT_OPTIONS,
  converter,
  isArray,
  isSingleDocumentQuery,
  extractRefs,
  walkGet,
  walkSet,
} from './helpers.js';


class Subscription {
  #unsubscription;
  #references;
  #update;

  /**
   * constructor - constructor of Subscription class
   *
   * @param  {Object}   query          firestore query
   * @param  {Object}   bindingTarget  object and its binding property
   * @param  {Function} update         callback of target updating
   */
  constructor(query, bindingTarget, update) {
    this.query = query;
    this.targetObject = bindingTarget.object;
    this.targetProperty = bindingTarget.property;
    this.options = { ...DEFAULT_OPTIONS };
    this.subscriptions = isSingleDocumentQuery(query) ? {} : [];
    this.references = [];

    this.#update = update ?? (() => {
      setTimeout(() => {
        this.data = isArray(this.data) ? [...this.data] : { ...this.data };
        walkSet(this.targetObject, this.targetProperty, this.data);
      }, 0);
    });
  }

  setOptions(options) {
    this.options = { ...this.options, ...options };
  }

  bind() {
    if (!this.query) {
      throw new Error('Subscription query not defined');
    }

    if (isSingleDocumentQuery(this.query)) {
      this.#bindDocument();
    } else {
      this.#bindCollection();
    }
  }

  unbind() {
    this.#unbindReferences();
    this.#unsubscription?.();
  }

  #bindDocument() {
    this.#unsubscription = this.query.withConverter(converter)
        .onSnapshot((doc) => {
          this.data = doc.data() || null;
          walkSet(this.targetObject, this.targetProperty, this.data);
          this.#unbindReferences();
          this.#bindReferences();
          this.#update();
        });
  }

  #bindCollection() {
    this.#unsubscription = this.query.withConverter(converter)
        .onSnapshot((snapshot) => {
          if (!isArray(this.data)) {
            this.data = [];
          }

          snapshot.docChanges().forEach((change) => {
            const data = change.doc.data();

            switch (change.type) {
              case 'added':
                this.#addItem(change.newIndex, data);
                break;
              case 'modified':
                this.#removeItem(change.oldIndex);
                this.#addItem(change.newIndex, data);
                break;
              case 'removed':
                this.#removeItem(change.oldIndex);
                break;
            }
          });

          walkSet(this.targetObject, this.targetProperty, this.data);
        });
  }

  #addItem(index, data) {
    this.data.splice(index, 0, data);
    this.subscriptions.splice(index, 0, {});
    this.references.splice(index, 0, []);
    this.#bindReferences(index);
  }

  #removeItem(index) {
    this.#unbindReferences(index);
    this.data.splice(index, 1);
    this.subscriptions.splice(index, 1);
    this.references.splice(index, 1);
  }

  #unbindReferences(index) {
    const isSingle = index === undefined;
    const references = isSingle ?
        this.references :
        this.references[index];
    const subscriptions = isSingle ?
        this.subscriptions :
        this.subscriptions[index];

    references.forEach((reference) => {
      const subscription = walkGet(subscriptions, reference.path);
      subscription.unbind();
    });

    if (isSingle) {
      this.references = [];
      this.subscriptions = {};
    } else {
      this.references[index] = [];
      this.subscriptions[index] = {};
    }
  }

  #bindReferences(index) {
    if (this.options.maxRefDepth > 0) {
      const isSingle = index === undefined;
      const data = isSingle ?
          this.data :
          this.data[index];
      const subscriptions = isSingle ?
          this.subscriptions = {} :
          this.subscriptions[index] = {};
      const references = extractRefs(data);
      const startPath = isSingle ? 'data.' : '';
      const targetObject = isSingle ? this : this.data[index];
      const options = { ...this.options };
      options.maxRefDepth--;


      references.forEach((reference) => {
        const subscription = new Subscription(
            reference.ref,
            { object: targetObject, property: startPath + reference.path },
            this.#update,
        );
        subscription.setOptions(options);
        subscription.bind();

        walkSet(subscriptions, reference.path, subscription);
      });


      if (isSingle) {
        this.references = references;
      } else {
        this.references[index] = references;
      }
    }
  }
}

export default Subscription;
