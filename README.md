# Fire7

Fire7 is a small library that implements real-time data binding between Firebase Cloud Firestore and your Framework7 app.

## Installation

```
npm i firebase fire7
```

⚠️ _At the moment, only Firebase version 8 is supported_ ⚠️

## Usage

You can use [Framework7 Store](https://framework7.io/docs/store.html) or a local variable in components as a target. In both cases, this preserves the reactivity of the interface.

Fire7 also operates in two modes:
1. one-time data getting;
2. real-time data binding.

We will use a code snippet below for our examples.

```javascript
import firebase from 'firebase';
import 'firebase/firestore';
import { createStore } from 'framework7';
import { firestoreAction } from 'fire7';

const firebaseConfig = {/* YOUR FIREBASE CONFIG */};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

const store = createStore({
  ...
});
```

We import the `firestoreAction` function from the _fire7_ package and pass there a callback function in which we define our Firestore query.

The arguments of the callback function will be passed an object containing the library methods, as well as the usual context of actions and payload.

```javascript
actions: {
  doSomething: firestoreAction((context) => {
    const {
      state,              // store state
      getters,            // store getters
      payload,            // action payload

      getFirestoreRef,    // get document once method
      bindFirestoreRef,   // listen document state
      unbindFirestoreRef  // stop listening
    } = context;

    ...
  })
}
```

### One-time data getting

Use a `getFirestoreRef` method for getting data one time. The first argument is the property name in the store state and the second is the Firestore query. You can also include filters, sorting and document limits in the query.

```javascript
const store = createStore({
  state: {
    company: null,
    employees: [],
  },

  actions: {
    init({dispatch}) {
      dispatch('getCompany', COMPANY_ID);
      dispatch('getEmployees', COMPANY_ID);
    },

    // getting a single document
    getCompany: firestoreAction(({getFirestoreRef, payload}) => {
      const query = db.collection('companies').doc(payload);
      return getFirestoreRef('company', query);
    }),

    // getting a collection of documents
    getEmployees: firestoreAction(({getFirestoreRef, payload}) => {
      const query = db.collection('employees').where('company', '==', payload);
      return getFirestoreRef('employees', query);
    })
  }
});
```

### Real-time data binding

Data binding is almost no different from a one-time data getting. Just use the `bindFirestoreRef` method. This method allows you to listen to documents change in real time.

```javascript
actions: {
  // binding a single document
  bindCompany: firestoreAction(({bindFirestoreRef, payload}) => {
    const query = db.collection('companies').doc(payload);
    return bindFirestoreRef('company', query);
  }),

  // binding a collection of documents
  bindEmployees: firestoreAction(({bindFirestoreRef, payload}) => {
    const query = db.collection('employees').where('company', '==', payload);
    return bindFirestoreRef('employees', query);
  })
}
```

#### Unbinding

To stop listening for documents changes use the `unbindFirestoreRef` method. As usual the first argument is the property name in the store state.

```javascript
actions: {
  stop({dispatch}) {
    dispatch('unbindCompany');
  },

  // unbinding a single document
  bindCompany: firestoreAction(({unbindFirestoreRef}) => {
    unbindFirestoreRef('company');
  }),
}
```

By default, Fire7 **will reset** the property, you can customize this behaviour by providing a second argument to the unbinding method.

```javascript
// default behavior
unbindFirestoreRef('company');
unbindFirestoreRef('company', true);
// $store.state.company === null

// using a boolean value for reset to keep current value
unbindFirestoreRef('company', false);
// $store.state.company === { name: 'LikePay Inc' }

// using the function syntax to customize the value
unbindFirestoreRef('company', () => ({ name: 'unregistered' }))
// $store.state.company === { name: 'unregistered' }

// for collections, they are reset to an empty array by default instead of `null`
unbindFirestoreRef('employees')
// $store.state.employees === []
```

### Using in components

Fire7 can also be used inside components. The special *ReactiveVariable* class replaces the store state. To make the *ReactiveVariable* instance reactive you must pass the *$update* method to the class constructor. This method will be called every time the value of the variable changes.

```html
<template>
  <div class="page">
    <div class="page-content">
      ${user.value}
    </div>
  </div>
</template>

<script>
import { firestoreAction, ReactiveVariable } from 'fire7';
import firebase from 'firebase';

export default (props, {$on, $update}) => {
  const user = new ReactiveVariable($update);

  const bindUser = firestoreAction(({bindFirestoreRef}) => {
    const query = firebase.firestore().collection('users').doc(USER_ID);
    return bindFirestoreRef('value', query);
  });

  const unbindUser = firestoreAction(({unbindFirestoreRef}) => {
    return unbindFirestoreRef('value', false);
  });

  $on('pageInit', () => {
    bindUser(user);
  });

  $on('pageBeforeremove', () => {
    unbindUser(user);
  });

  return $render;
}
</script>
```

As you can see, working in components is slightly different from working in the store.

When calling an analog of the storage action, we need to pass our reactive variable as a parameter.

Also, instead of the name of the stores state parameter, we have to pass a string value `'value'` into  `bindFirestoreRef`, `unbindFirestoreRef` and `getFirestoreRef` methods.

### Options

Fire7 can get nested documents and put them instead of reference fields. By default, only the first 2 nested levels will be loaded but you can override this value by passing custom options as the third parameter of `getFirestoreRef` and `bindFirestoreRef` methods.

```javascript
getFirestoreRef('company', query, { maxRefDepth: 0 }); // reference fields will not be loaded

bindFirestoreRef('company', query, { maxRefDepth: 3 }); // 3 nested levels will be loaded
```
