const DEFAULT_OPTIONS = {
  maxRefDepth: 2,
};


const converter = {
  fromFirestore: function(doc, options) {
    return {
      id: doc.id,
      ...doc.data(options),
    };
  },
};


/**
 * isArray - checks if a target is an array
 *
 * @param  {Array}   target
 * @return {Boolean}
 */
function isArray(target) {
  return Array.isArray(target);
}


/**
 * isFirestoreRef - checks if a target is a Firestore reference
 *
 * @param  {Object}   target
 * @return {Boolean}
 */
function isFirestoreRef(target) {
  return isObject(target) && !!target.onSnapshot;
}


/**
 * isObject - checks if a target is an object
 *
 * @param  {Object}  target
 * @return {Boolean}
 */
function isObject(target) {
  return !!target && typeof target === 'object';
}


/**
 * isSingleDocumentQuery - checks if a query of single Firestore document
 *
 * @param  {Object} query  firestore query
 * @return {Boolean}
 */
function isSingleDocumentQuery(query) {
  return 'update' in query;
}


/**
 * fillRefs - fill in all the reference properties of the object
 *
 * @param  {Object}   obj     original object
 * @param  {Function} update  callback of state updating
 * @param  {Object}   options fill options
 */
function fillRefs(obj, update, options) {
  if (options.maxRefDepth > 0) {
    const refs = [];
    // TODO: replace data for real store propperty name
    extractRefs({ data: obj }, 'data', refs);

    Promise.all(refs.map((r) => r.ref.withConverter(converter).get()))
        .then((results) => {
          refs.forEach((ref, i) => {
            const path = ref.path.slice(5);
            walkSet({ data: obj }, path, results[i].data());
          });

          update?.();

          const opt = Object.assign({}, options);
          opt.maxRefDepth--;
          fillRefs(obj, update, opt);
        });
  }
}


/**
 * extractRefs - get all reference fields of object
 *
 * @param  {Object} obj               target object
 * @param  {String} currentPath = ''  path of object in document
 * @param  {Array}  subs = []         list of subreferences
 * @return {Array}                    list of subreferences
 */
function extractRefs(obj, currentPath = '', subs = []) {
  if (!isObject(obj)) {
    return subs;
  }

  if (isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      if (isObject(obj[i])) {
        if (isFirestoreRef(obj[i])) {
          subs.push({
            path: `${currentPath}[${i}]`,
            ref: obj[i],
          });
        } else {
          extractRefs(obj[i], `${currentPath}[${i}]`, subs);
        }
      }
    }
  } else {
    for (const prop in obj) {
      if (obj.hasOwnProperty(prop) && isObject(obj[prop])) {
        const startPath = (currentPath ? currentPath + '.' : '');

        if (isFirestoreRef(obj[prop])) {
          subs.push({
            path: startPath + prop,
            ref: obj[prop],
          });
        } else {
          extractRefs(obj[prop], startPath + prop, subs);
        }
      }
    }
  }

  return subs;
}


/**
 * walkGet - deeply get a object property with a string path
 *
 * @param  {Object} object  target object
 * @param  {String} path    property path
 * @return {Any}            property value
 */
function walkGet(object, path) {
  path = path.replace(/\[(\w+)\]/g, '.$1'); // convert indexes to properties
  path = path.replace(/^\./, ''); // strip a leading dot
  const arr = path.split('.');
  for (let i = 0, n = arr.length; i < n; ++i) {
    const key = arr[i];
    if (object && typeof object === 'object' && key in object) {
      object = object[key];
    } else {
      return;
    }
  }
  return object;
};


/**
 * walkSet - deeply set a property in an object with a string path
 *
 * @param  {Object} object  target object
 * @param  {String} path    property path
 * @param  {Any}    value   property value
 * @return {Object}         result object
 */
function walkSet(object, path, value) {
  return path.split('.').reduce((obj, segment, i, segmentList) => {
    let arrayName;
    let arrayIndex;
    const arrayMatch = segment.match(/^(.+)\[(\d+)\]$/);

    if (arrayMatch) {
      arrayName = arrayMatch[1];
      arrayIndex = Number(arrayMatch[2]);

      if (!obj[arrayName]) {
        obj[arrayName] = [];
      }

      if (obj[arrayName].length < arrayIndex + 1) {
        obj[arrayName].length = arrayIndex + 1;
      }
    }


    if (i <= segmentList.length - 2) {
      if (arrayMatch) {
        if (!obj[arrayName][arrayIndex]) {
          obj[arrayName][arrayIndex] = {};
        }

        return obj[arrayName][arrayIndex];
      } else {
        if (!obj[segment]) {
          obj[segment] = {};
        }

        return obj[segment];
      }
    } else {
      if (arrayMatch) {
        obj[arrayName][arrayIndex] = value;
      } else {
        obj[segment] = value;
      }
      return obj;
    }
  }, object);
}


export {
  DEFAULT_OPTIONS,
  converter,
  isArray,
  isFirestoreRef,
  isObject,
  fillRefs,
  isSingleDocumentQuery,
  extractRefs,
  walkGet,
  walkSet,
};
